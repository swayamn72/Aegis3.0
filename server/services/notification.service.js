import admin from '../config/firebase.js';
import Player from '../models/player.model.js';
import Notification from '../models/notification.model.js';

class NotificationService {
  /**
   * Send a push notification to a specific player
   * @param {string} playerId - The MongoDB ID of the player
   * @param {string} title - The notification title
   * @param {string} body - The notification body
   * @param {object} dataPayload - Additional data payload (optional)
   */
  async sendToPlayer(playerId, title, body, dataPayload = {}) {
    try {
      const player = await Player.findById(playerId).select('fcmToken');
      
      if (!player || !player.fcmToken) {
        // Player not found or has no active FCM token
        return { success: false, reason: 'No FCM token' };
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: dataPayload,
        token: player.fcmToken,
      };

      const response = await admin.messaging().send(message);

      // Persist in DB for Notification Center (fire-and-forget)
      Notification.create({
        recipient: playerId,
        title,
        body,
        type: dataPayload.type || 'system',
        data: dataPayload
      }).catch(err => console.error('Notification persist error:', err));

      return { success: true, response };
    } catch (error) {
      console.error(`FCM send error for player ${playerId}:`, error.message);
      
      // Cleanup token if it's invalid/unregistered
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await Player.findByIdAndUpdate(playerId, { $unset: { fcmToken: 1 } });
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to an array of players
   * Firebase allows up to 500 tokens in a single multicast call.
   * This is fast, optimal, and doesn't require queueing for typical batch sizes (like 320 players).
   * 
   * @param {Array<string>} playerIds - Array of MongoDB IDs
   * @param {string} title - The notification title
   * @param {string} body - The notification body
   * @param {object} dataPayload - Additional data payload (optional)
   */
  async sendToMultiplePlayers(playerIds, title, body, dataPayload = {}) {
    try {
      const players = await Player.find({ 
        _id: { $in: playerIds }, 
        fcmToken: { $exists: true, $ne: null } 
      }).select('fcmToken');

      if (!players.length) {
        return { success: false, reason: 'No FCM tokens found' };
      }

      const tokens = players.map(p => p.fcmToken);

      // Create chunks of 500 tokens (Firebase multicast limit)
      const chunkSize = 500;
      let totalSuccess = 0;
      let totalFailure = 0;

      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunkTokens = tokens.slice(i, i + chunkSize);
        const chunkPlayers = players.slice(i, i + chunkSize);
        
        const message = {
          notification: { title, body },
          data: dataPayload,
          tokens: chunkTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        // Persist in DB for Notification Center (fire-and-forget)
        const notificationDocs = chunkPlayers.map(p => ({
          recipient: p._id,
          title,
          body,
          type: dataPayload.type || 'system',
          data: dataPayload
        }));
        Notification.insertMany(notificationDocs, { ordered: false }).catch(err => console.error('Notification batch persist error:', err));

        // Cleanup invalid tokens in the background
        if (response.failureCount > 0) {
          response.responses.forEach((res, index) => {
            if (!res.success) {
              const errCode = res.error?.code;
              if (
                errCode === 'messaging/invalid-registration-token' ||
                errCode === 'messaging/registration-token-not-registered'
              ) {
                // Background cleanup to avoid awaiting heavily loop
                Player.findByIdAndUpdate(chunkPlayers[index]._id, { $unset: { fcmToken: 1 } }).catch(e => console.error('Token cleanup error:', e));
              }
            }
          });
        }
      }

      return { success: true, successCount: totalSuccess, failureCount: totalFailure };
    } catch (error) {
      console.error('FCM sendToMultiplePlayers error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new NotificationService();
