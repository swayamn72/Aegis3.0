import mongoose from 'mongoose';
import ChatMessage from '../models/chat.model.js';
import DirectMessageRequest from '../models/directMessageRequest.model.js';

const toId = (value) => (value ? value.toString() : '');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(toId(value));

const pairQuery = (userA, userB) => {
    const a = toId(userA);
    const b = toId(userB);
    return {
        $or: [
            { requester: a, recipient: b },
            { requester: b, recipient: a },
        ],
    };
};

export const hasLegacyConversation = async (userA, userB) => {
    const a = toId(userA);
    const b = toId(userB);
    if (!isValidObjectId(a) || !isValidObjectId(b) || a === b) return false;

    const existing = await ChatMessage.exists({
        $or: [
            { senderId: a, receiverId: b },
            { senderId: b, receiverId: a },
        ],
        senderId: { $ne: 'system' },
        receiverId: { $ne: 'system' },
    });

    return Boolean(existing);
};

export const getMessageRequestRelationship = async (viewerId, targetUserId) => {
    const viewer = toId(viewerId);
    const target = toId(targetUserId);

    if (!isValidObjectId(viewer) || !isValidObjectId(target) || viewer === target) {
        return {
            canMessage: false,
            status: 'none',
            requestId: null,
        };
    }

    const [legacyConversation, acceptedRequest, pendingSent, pendingReceived] = await Promise.all([
        hasLegacyConversation(viewer, target),
        DirectMessageRequest.findOne({ ...pairQuery(viewer, target), status: 'accepted' })
            .select('_id')
            .lean(),
        DirectMessageRequest.findOne({ requester: viewer, recipient: target, status: 'pending' })
            .select('_id')
            .lean(),
        DirectMessageRequest.findOne({ requester: target, recipient: viewer, status: 'pending' })
            .select('_id')
            .lean(),
    ]);

    if (legacyConversation) {
        return {
            canMessage: true,
            status: 'legacy_conversation',
            requestId: null,
        };
    }

    if (acceptedRequest) {
        return {
            canMessage: true,
            status: 'accepted',
            requestId: acceptedRequest._id.toString(),
        };
    }

    if (pendingSent) {
        return {
            canMessage: false,
            status: 'pending_sent',
            requestId: pendingSent._id.toString(),
        };
    }

    if (pendingReceived) {
        return {
            canMessage: false,
            status: 'pending_received',
            requestId: pendingReceived._id.toString(),
        };
    }

    return {
        canMessage: false,
        status: 'none',
        requestId: null,
    };
};

export const ensurePendingMessageRequest = async ({ requesterId, recipientId, initialMessage = '' }) => {
    const requester = toId(requesterId);
    const recipient = toId(recipientId);

    if (!isValidObjectId(requester) || !isValidObjectId(recipient) || requester === recipient) {
        return {
            created: false,
            status: 'invalid',
            request: null,
        };
    }

    const [pendingSent, pendingReceived] = await Promise.all([
        DirectMessageRequest.findOne({ requester, recipient, status: 'pending' }),
        DirectMessageRequest.findOne({ requester: recipient, recipient: requester, status: 'pending' }),
    ]);

    if (pendingSent) {
        return { created: false, status: 'pending_sent', request: pendingSent };
    }

    if (pendingReceived) {
        return { created: false, status: 'pending_received', request: pendingReceived };
    }

    const request = await DirectMessageRequest.create({
        requester,
        recipient,
        status: 'pending',
        initialMessage: initialMessage ? String(initialMessage).trim().slice(0, 500) : '',
    });

    return {
        created: true,
        status: 'pending_sent',
        request,
    };
};
