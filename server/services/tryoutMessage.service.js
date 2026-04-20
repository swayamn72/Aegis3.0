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
    { includeLegacy = true, legacyMessages = [], sort = 1, previewLimit = null } = {}
) => {
    const chatObjectId = asObjectId(chatId);
    if (!chatObjectId) return [];

    const hasLegacy = includeLegacy && Array.isArray(legacyMessages) && legacyMessages.length > 0;

    // Fast path: list preview with no legacy messages — push limit into the DB query.
    // Fetch the tail cheaply by sorting DESC, limiting, then reversing to ASC.
    if (previewLimit !== null && !hasLegacy) {
        const tail = await TryoutMessage.find({ chatId: chatObjectId })
            .sort({ timestamp: -1, _id: -1 })
            .limit(previewLimit)
            .lean();
        tail.reverse(); // back to chronological ASC
        return tail.map((msg) => ({
            _id: msg._id,
            sender: msg.sender,
            message: msg.message,
            messageType: msg.messageType,
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: msg.timestamp,
        }));
    }

    // Full fetch path (single-chat view or legacy-merge required)
    const storedMessages = await TryoutMessage.find({ chatId: chatObjectId })
        .sort({ timestamp: sort, _id: sort })
        .lean();

    const transformedStored = storedMessages.map((msg) => ({
        _id: msg._id,
        sender: msg.sender,
        message: msg.message,
        messageType: msg.messageType,
        ...(msg.metadata ? { metadata: msg.metadata } : {}),
        timestamp: msg.timestamp,
    }));

    if (!hasLegacy) {
        return transformedStored;
    }

    const transformedLegacy = legacyMessages.map((msg, index) => ({
        _id: msg._id || `legacy_${index}`,
        sender: msg.sender,
        message: msg.message,
        messageType: msg.messageType || 'text',
        ...(msg.metadata ? { metadata: msg.metadata } : {}),
        timestamp: msg.timestamp,
    }));

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

    // Apply previewLimit on merged result
    if (previewLimit !== null && deduped.length > previewLimit) {
        return deduped.slice(-previewLimit);
    }
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
