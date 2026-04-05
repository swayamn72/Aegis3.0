import express from 'express';
import Player from '../models/player.model.js';
import Notification from '../models/notification.model.js';
import auth from '../middleware/auth.js';

const router = express.Router();

const defaultPreferences = {
    enabled: true,
    directMessages: true,
    tryoutMessages: true,
    eventNotifications: true,
};

// POST /api/notifications/update-fcm-token
router.post('/update-fcm-token', auth, async (req, res) => {
    try {
        const { fcmToken } = req.body;
        const userId = req.user.id;

        if (!fcmToken) {
            return res.status(400).json({ error: 'fcmToken is required' });
        }

        const player = await Player.findByIdAndUpdate(
            userId,
            { fcmToken },
            { new: true }
        );

        if (!player) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'FCM token updated successfully' });
    } catch (error) {
        console.error('Error updating FCM token:', error);
        res.status(500).json({ error: 'Failed to update FCM token' });
    }
});

// GET /api/notifications/settings
// Fetch notification preferences + muted tryout chat ids
router.get('/settings', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const player = await Player.findById(userId)
            .select('notificationPreferences mutedTryoutChats')
            .lean();

        if (!player) {
            return res.status(404).json({ error: 'User not found' });
        }

        const preferences = {
            ...defaultPreferences,
            ...(player.notificationPreferences || {}),
        };

        res.json({
            preferences,
            mutedTryoutChats: (player.mutedTryoutChats || []).map((id) => id.toString()),
        });
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
});

// PATCH /api/notifications/settings
// Update notification preferences toggles
router.patch('/settings', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const payload = req.body || {};
        const keys = ['enabled', 'directMessages', 'tryoutMessages', 'eventNotifications'];
        const updates = {};

        for (const key of keys) {
            if (payload[key] !== undefined) {
                if (typeof payload[key] !== 'boolean') {
                    return res.status(400).json({ error: `${key} must be a boolean` });
                }
                updates[`notificationPreferences.${key}`] = payload[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid preference fields provided' });
        }

        const player = await Player.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true }
        )
            .select('notificationPreferences mutedTryoutChats')
            .lean();

        if (!player) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            preferences: {
                ...defaultPreferences,
                ...(player.notificationPreferences || {}),
            },
            mutedTryoutChats: (player.mutedTryoutChats || []).map((id) => id.toString()),
        });
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ error: 'Failed to update notification settings' });
    }
});

// GET /api/notifications
// Fetch paginated notification history for the logged-in player
router.get('/', auth, async (req, res) => {
    try {
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const hasOffset = req.query.offset !== undefined;
        const offset = hasOffset
            ? Math.max(0, parseInt(req.query.offset, 10) || 0)
            : (page - 1) * limit;
        const userId = req.user.id;

        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean();

        const total = await Notification.countDocuments({ recipient: userId });
        const hasMore = (offset + limit) < total;

        res.json({
            notifications,
            pagination: {
                total,
                limit,
                offset,
                page: Math.floor(offset / limit) + 1,
                hasMore
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /api/notifications/unread-count
// Get the count of unread notifications
router.get('/unread-count', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.countDocuments({ recipient: userId, isRead: false });
        res.json({ unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// PATCH /api/notifications/mark-read/:id
// Mark a specific notification as read
router.patch('/mark-read/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// PATCH /api/notifications/mark-all-read
// Mark all notifications for the user as read
router.patch('/mark-all-read', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        await Notification.updateMany(
            { recipient: userId, isRead: false },
            { isRead: true }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

// POST /api/notifications/test-notification
// Use this to verify the Flutter app's deep linking
import notificationService from '../services/notification.service.js';
router.post('/test-notification', auth, async (req, res) => {
    try {
        const { type } = req.body;
        const userId = req.user.id;

        let title = 'Test Notification';
        let body = 'This is a test message from the backend.';
        let data = { type: type || 'test' };

        // Mock IDs for testing deep linking
        const mockId = '65f1a2b3c4d5e6f7a8b9c0d1';

        switch (type) {
            case 'match_scheduled':
                title = '📅 Match Scheduled';
                body = 'Test Match in Pro League - Phase 1';
                data = { type, matchId: mockId, tournamentId: mockId };
                break;
            case 'room_credentials':
                title = '🔑 Room Credentials Shared';
                body = 'Match #1 - ID: 123456 | Pass: aegis';
                data = { type, matchId: mockId, tournamentId: mockId };
                break;
            case 'team_offer':
                title = '🏆 Team Offer Received';
                body = 'Team Storm has sent you a join offer!';
                data = { type, chatId: mockId };
                break;
            case 'tryout_ended':
                title = '❌ Tryout Ended';
                body = 'Your tryout with Team Storm has ended.';
                data = { type, chatId: mockId };
                break;
        }

        const result = await notificationService.sendToPlayer(userId, title, body, data);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ error: 'Failed to send test notification' });
    }
});

export default router;
