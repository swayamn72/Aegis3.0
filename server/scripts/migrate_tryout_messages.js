import mongoose from 'mongoose';
import dotenv from 'dotenv';

import TryoutChat from '../models/tryoutChat.model.js';
import TryoutMessage from '../models/tryoutMessage.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not set');
    process.exit(1);
}

const BATCH_SIZE = 100;

const buildMessageKey = (msg) => {
    const timestamp = new Date(msg.timestamp || Date.now()).toISOString();
    return `${msg.sender}|${msg.messageType || 'text'}|${msg.message}|${timestamp}`;
};

const migrateChatMessages = async (chat) => {
    const legacyMessages = Array.isArray(chat.messages) ? chat.messages : [];
    if (legacyMessages.length === 0) {
        await TryoutChat.updateOne(
            { _id: chat._id },
            {
                $set: {
                    messagesMigratedAt: chat.messagesMigratedAt || new Date(),
                    legacyMessageCount: chat.legacyMessageCount || 0,
                },
            }
        );
        return { inserted: 0, cleared: false };
    }

    const existing = await TryoutMessage.find({ chatId: chat._id })
        .select('sender message messageType timestamp')
        .lean();

    const existingKeys = new Set(existing.map(buildMessageKey));
    const toInsert = [];

    for (const msg of legacyMessages) {
        const normalized = {
            sender: String(msg.sender || 'system'),
            message: String(msg.message || ''),
            messageType: msg.messageType || 'text',
            timestamp: msg.timestamp || new Date(),
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
        };

        const key = buildMessageKey(normalized);
        if (!existingKeys.has(key)) {
            existingKeys.add(key);
            toInsert.push({
                chatId: chat._id,
                ...normalized,
            });
        }
    }

    if (toInsert.length > 0) {
        await TryoutMessage.insertMany(toInsert, { ordered: false });
    }

    await TryoutChat.updateOne(
        { _id: chat._id },
        {
            $set: {
                messagesMigratedAt: new Date(),
                legacyMessageCount: legacyMessages.length,
                messages: [],
            },
        }
    );

    return { inserted: toInsert.length, cleared: true };
};

const run = async () => {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    let lastId = null;
    let migratedChats = 0;
    let insertedMessages = 0;

    while (true) {
        const query = {
            $and: [
                {
                    $or: [
                        { messagesMigratedAt: { $exists: false } },
                        { messagesMigratedAt: null },
                        { 'messages.0': { $exists: true } },
                    ],
                },
                ...(lastId ? [{ _id: { $gt: lastId } }] : []),
            ],
        };

        const chats = await TryoutChat.find(query)
            .select('_id messages messagesMigratedAt legacyMessageCount')
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .lean();

        if (chats.length === 0) {
            break;
        }

        for (const chat of chats) {
            const result = await migrateChatMessages(chat);
            migratedChats += 1;
            insertedMessages += result.inserted;
        }

        lastId = chats[chats.length - 1]._id;
        console.log(`Processed ${migratedChats} chats so far...`);
    }

    console.log(`Migration complete. Chats processed: ${migratedChats}, messages inserted: ${insertedMessages}`);
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error('Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
});
