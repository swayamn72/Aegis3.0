import admin from '../config/firebase.js';
import Player from '../models/player.model.js';
import Notification from '../models/notification.model.js';
import Organization from '../models/organization.model.js';
import Registration from '../models/registration.model.js';

class NotificationService {
  _defaultPrefs() {
    return {
      enabled: true,
      directMessages: true,
      tryoutMessages: true,
      eventNotifications: true,
    };
  }

  _getPreferenceCategory(type = '') {
    const t = String(type).toLowerCase();
    if (t === 'chat_message') return 'directMessages';
    if (t === 'tryout_chat_message') return 'tryoutMessages';
    return 'eventNotifications';
  }

  _extractTryoutChatId(dataPayload = {}) {
    const raw = dataPayload.chatId || dataPayload.tryoutChatId || null;
    return raw ? raw.toString() : null;
  }

  _normalizeFcmData(dataPayload = {}) {
    const output = {};
    for (const [key, value] of Object.entries(dataPayload || {})) {
      if (value === undefined || value === null) continue;
      output[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return output;
  }

  _canNotifyPlayer(playerDoc, dataPayload = {}) {
    if (!playerDoc) return false;

    const prefs = {
      ...this._defaultPrefs(),
      ...(playerDoc.notificationPreferences || {}),
    };

    if (!prefs.enabled) return false;

    const category = this._getPreferenceCategory(dataPayload.type);
    if (prefs[category] === false) return false;

    if (category === 'tryoutMessages') {
      const chatId = this._extractTryoutChatId(dataPayload);
      if (chatId) {
        const mutedSet = new Set(
          (playerDoc.mutedTryoutChats || []).map((id) => id.toString())
        );
        if (mutedSet.has(chatId)) return false;
      }
    }

    return true;
  }

  /**
   * Send a push notification to a specific player
   * @param {string} playerId - The MongoDB ID of the player
   * @param {string} title - The notification title
   * @param {string} body - The notification body
   * @param {object} dataPayload - Additional data payload (optional)
   */
  async sendToPlayer(playerId, title, body, dataPayload = {}) {
    try {
      const player = await Player.findById(playerId)
        .select('fcmToken notificationPreferences mutedTryoutChats');

      if (!player) {
        return { success: false, reason: 'Player not found' };
      }

      if (!this._canNotifyPlayer(player, dataPayload)) {
        return { success: false, reason: 'Notification disabled by user preferences' };
      }

      await Notification.create({
        recipient: playerId,
        title,
        body,
        type: dataPayload.type || 'system',
        data: dataPayload
      }).catch(err => console.error('Notification persist error:', err));

      if (!player.fcmToken) {
        // Player not found or has no active FCM token
        return { success: false, reason: 'No FCM token', persisted: true };
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: this._normalizeFcmData(dataPayload),
        token: player.fcmToken,
      };

      const response = await admin.messaging().send(message);

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
      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        return { success: false, reason: 'No recipients provided' };
      }

      const players = await Player.find({
        _id: { $in: playerIds },
      }).select('fcmToken notificationPreferences mutedTryoutChats');

      const eligiblePlayers = players.filter((p) => this._canNotifyPlayer(p, dataPayload));
      const eligiblePlayerIds = eligiblePlayers.map((p) => p._id.toString());

      if (eligiblePlayerIds.length > 0) {
        const notificationDocs = eligiblePlayerIds.map(id => ({
          recipient: id,
          title,
          body,
          type: dataPayload.type || 'system',
          data: dataPayload
        }));

        Notification.insertMany(notificationDocs, { ordered: false }).catch(err => console.error('Notification batch persist error:', err));
      }

      const tokenPlayers = eligiblePlayers.filter((p) => p.fcmToken);

      if (!tokenPlayers.length) {
        return { success: false, reason: 'No eligible recipients with FCM tokens' };
      }

      const tokens = tokenPlayers.map(p => p.fcmToken);

      // Create chunks of 500 tokens (Firebase multicast limit)
      const chunkSize = 500;
      let totalSuccess = 0;
      let totalFailure = 0;

      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunkTokens = tokens.slice(i, i + chunkSize);
        const chunkPlayers = tokenPlayers.slice(i, i + chunkSize);

        const message = {
          notification: { title, body },
          data: this._normalizeFcmData(dataPayload),
          tokens: chunkTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

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
  /**
   * Notify the org admin(s) of a tournament.
   * Looks up Organization.ownedBy (the org owner's player account) and sends a push.
   * @param {string|ObjectId} tournamentId
   * @param {{ title: string, body: string, data: object }} payload
   */
  async notifyOrgForTournament(tournamentId, { title, body, data = {} }) {
    try {
      // Tournament.organizer is a sub-object: { name, website, contactEmail, organizationRef }
      const Tournament = (await import('../models/tournament.model.js')).default;
      const tournament = await Tournament.findById(tournamentId)
        .select('organizer.organizationRef organizer.contactEmail')
        .lean();
      if (!tournament?.organizer?.organizationRef) return;

      const orgId = tournament.organizer.organizationRef;

      // Organization model doesn't have fcmToken or linkedPlayerId.
      // Best-effort: find any Player account whose team belongs to this org.
      // For now, we log the notification — push to org admins can be added
      // when the Organization model gets an fcmToken field.
      console.log(`[Notification] Org ${orgId}: ${title} — ${body}`);
    } catch (err) {
      console.error('notifyOrgForTournament error:', err.message);
    }
  }

  /**
   * Notify all members of specified teams in a tournament.
   * @param {string[]} teamIds — team ObjectId strings
   * @param {string|ObjectId} tournamentId
   * @param {{ title: string, body: string, data: object }} payload
   */
  async notifyTeams(teamIds, tournamentId, { title, body, data = {} }) {
    try {
      if (!teamIds?.length) return;
      const regs = await Registration.find({
        tournament: tournamentId,
        team: { $in: teamIds },
        status: { $in: ['registered', 'confirmed', 'approved', 'checked_in'] },
      }).select('roster.player').lean();

      const playerIds = [];
      for (const reg of regs) {
        for (const slot of reg.roster || []) {
          if (slot.player) playerIds.push(slot.player.toString());
        }
      }

      if (playerIds.length > 0) {
        await this.sendToMultiplePlayers([...new Set(playerIds)], title, body, data);
      }
    } catch (err) {
      console.error('notifyTeams error:', err.message);
    }
  }
}

export default new NotificationService();
