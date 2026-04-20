import express from 'express';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import Player from '../models/player.model.js';
import UserBlock from '../models/userBlock.model.js';
import UserReport from '../models/userReport.model.js';

const router = express.Router();

const REPORT_REASONS = new Set([
    'harassment',
    'hate_speech',
    'spam',
    'sexual_content',
    'violence',
    'impersonation',
    'scam_fraud',
    'other',
]);

// GET /api/moderation/blocks - list users blocked by current user
router.get('/blocks', auth, async (req, res) => {
    try {
        const rows = await UserBlock.find({ blocker: req.user.id })
            .populate('blocked', '_id username profilePicture')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            blocks: rows.map((row) => ({
                _id: row._id,
                createdAt: row.createdAt,
                reason: row.reason || '',
                blockedUser: row.blocked,
            })),
        });
    } catch (error) {
        console.error('Get blocks error:', error);
        res.status(500).json({ message: 'Failed to fetch blocked users' });
    }
});

// GET /api/moderation/relationship/:targetUserId - block relationship status
router.get('/relationship/:targetUserId', auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: 'Invalid target user ID' });
        }

        const targetExists = await Player.exists({ _id: targetUserId });
        if (!targetExists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const [iBlocked, blockedMe] = await Promise.all([
            UserBlock.exists({ blocker: req.user.id, blocked: targetUserId }),
            UserBlock.exists({ blocker: targetUserId, blocked: req.user.id }),
        ]);

        res.json({
            iBlocked: Boolean(iBlocked),
            blockedMe: Boolean(blockedMe),
            isBlocked: Boolean(iBlocked || blockedMe),
        });
    } catch (error) {
        console.error('Get relationship error:', error);
        res.status(500).json({ message: 'Failed to fetch relationship status' });
    }
});

// POST /api/moderation/block/:targetUserId
router.post('/block/:targetUserId', auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const reason = (req.body?.reason || '').toString().trim();

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: 'Invalid target user ID' });
        }

        if (req.user.id.toString() === targetUserId.toString()) {
            return res.status(400).json({ message: 'You cannot block yourself' });
        }

        const targetExists = await Player.exists({ _id: targetUserId });
        if (!targetExists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const block = await UserBlock.findOneAndUpdate(
            { blocker: req.user.id, blocked: targetUserId },
            { $setOnInsert: { blocker: req.user.id, blocked: targetUserId, reason } },
            { new: true, upsert: true }
        );

        res.json({ message: 'User blocked successfully', blockId: block._id });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ message: 'Failed to block user' });
    }
});

// DELETE /api/moderation/block/:targetUserId
router.delete('/block/:targetUserId', auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: 'Invalid target user ID' });
        }

        await UserBlock.deleteOne({ blocker: req.user.id, blocked: targetUserId });
        res.json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ message: 'Failed to unblock user' });
    }
});

// POST /api/moderation/report/user
router.post('/report/user', auth, async (req, res) => {
    try {
        const {
            targetUserId,
            reason,
            details = '',
            messageId = null,
            chatType = 'unknown',
        } = req.body || {};

        if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: 'Valid target user ID is required' });
        }

        if (req.user.id.toString() === targetUserId.toString()) {
            return res.status(400).json({ message: 'You cannot report yourself' });
        }

        if (!REPORT_REASONS.has(reason)) {
            return res.status(400).json({ message: 'Invalid report reason' });
        }

        const targetExists = await Player.exists({ _id: targetUserId });
        if (!targetExists) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (details && details.length > 2000) {
            return res.status(400).json({ message: 'Details too long (max 2000 chars)' });
        }

        if (messageId && !mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID' });
        }

        const report = await UserReport.create({
            reporter: req.user.id,
            target: {
                user: targetUserId,
                messageId: messageId || null,
                chatType: ['direct', 'tryout', 'unknown'].includes(chatType)
                    ? chatType
                    : 'unknown',
            },
            reason,
            details: details?.trim() || '',
        });

        res.status(201).json({
            message: 'Report submitted successfully',
            reportId: report._id,
        });
    } catch (error) {
        console.error('Report user error:', error);
        res.status(500).json({ message: 'Failed to submit report' });
    }
});

export default router;
