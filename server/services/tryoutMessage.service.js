import mongoose from 'mongoose';

import TryoutMessage from '../models/tryoutMessage.model.js';

const asObjectId = (id) => {
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (!id) return null;
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return new mongoose.Types.ObjectId(id);
};

const keyForMessage = (msg) => {
    const timestamp = msg.timestamp instanceof Date
        ? msg.timestamp.toISOString()
        : new Date(msg.timestamp).toISOString();
    return `${msg.sender}|${msg.messageType}|${msg.message}|${timestamp}`;
};

export const createTryoutMessage = async ({
    chatId,
    sender,
    message,
    messageType = 'text',
    metadata,
    timestamp,
}) => {
    const chatObjectId = asObjectId(chatId);
    if (!chatObjectId) throw new Error('Invalid tryout chat id');

    return TryoutMessage.create({
        chatId: chatObjectId,
        sender,
        message,
        messageType,
        ...(metadata ? { metadata } : {}),
        ...(timestamp ? { timestamp } : {}),
    });
};

export const fetchTryoutMessages = async (
    chatId,
    { includeLegacy = true, legacyMessages = [], sort = 1 } = {}
) => {
    const chatObjectId = asObjectId(chatId);
    if (!chatObjectId) return [];

    const storedMessages = await TryoutMessage.find({ chatId: chatObjectId })
        .sort({ timestamp: sort, _id: sort })
        .lean();

    const transformedStored = storedMessages.map((msg) => {
        return {
            _id: msg._id,
            sender: msg.sender,
            message: msg.message,
            messageType: msg.messageType,
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: msg.timestamp,
        };
    });

    if (!includeLegacy || !Array.isArray(legacyMessages) || legacyMessages.length === 0) {
        return transformedStored;
    }

    const transformedLegacy = legacyMessages.map((msg, index) => {
        return {
            _id: msg._id || `legacy_${index}`,
            sender: msg.sender,
            message: msg.message,
            messageType: msg.messageType || 'text',
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: msg.timestamp,
        };
    });

    const merged = [...transformedLegacy, ...transformedStored];
    const deduped = [];
    const seen = new Set();

    for (const msg of merged) {
        const key = keyForMessage(msg);
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(msg);
        }
    }

    deduped.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return deduped;
};

export const appendSystemTryoutMessage = async (chatId, message, metadata) => {
    return createTryoutMessage({
        chatId,
        sender: 'system',
        message,
        messageType: 'system',
        ...(metadata ? { metadata } : {}),
        timestamp: new Date(),
    });
};
