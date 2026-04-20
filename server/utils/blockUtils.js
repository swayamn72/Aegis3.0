import mongoose from 'mongoose';
import UserBlock from '../models/userBlock.model.js';

const normalizeId = (value) => {
    if (!value) return null;
    return value.toString();
};

export const isEitherUserBlocked = async (userA, userB) => {
    const a = normalizeId(userA);
    const b = normalizeId(userB);

    if (!a || !b || a === b) return false;
    if (!mongoose.Types.ObjectId.isValid(a) || !mongoose.Types.ObjectId.isValid(b)) {
        return false;
    }

    const relation = await UserBlock.exists({
        $or: [
            { blocker: a, blocked: b },
            { blocker: b, blocked: a },
        ],
    });

    return Boolean(relation);
};

export const getBlockedUserIdSetForUser = async (userId) => {
    const id = normalizeId(userId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return new Set();
    }

    const relations = await UserBlock.find({
        $or: [{ blocker: id }, { blocked: id }],
    })
        .select('blocker blocked')
        .lean();

    const blockedSet = new Set();
    relations.forEach((r) => {
        const blocker = normalizeId(r.blocker);
        const blocked = normalizeId(r.blocked);
        if (blocker === id && blocked) blockedSet.add(blocked);
        if (blocked === id && blocker) blockedSet.add(blocker);
    });

    return blockedSet;
};
