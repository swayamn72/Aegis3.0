import express from 'express';
import Player from '../models/player.model.js';

const router = express.Router();

// POST /api/notifications/update-fcm-token
router.post('/update-fcm-token', async (req, res) => {
    try {
        const { userId, fcmToken } = req.body;
        if (!userId || !fcmToken) {
            return res.status(400).json({ error: 'userId and fcmToken are required' });
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

export default router;
