/**
 * Match Room Routes
 *
 * REST API for match room chat + active match listing.
 * Real-time messaging happens via WebSocket; these provide:
 *   - List a player's active matches
 *   - Fetch message history for a match room
 *   - Send a message (REST fallback)
 *
 * Authorization: Any registered player/org admin in the match.
 */

import express from 'express';
import mongoose from 'mongoose';
import MatchRoomMessage from '../models/matchRoomMessage.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import { verifyToken } from '../middleware/auth.js';
import { assertMatchRoomParticipant } from '../utils/matchRoomAuth.js';

const router = express.Router();

// ─── GET /api/match-rooms/my-matches ──────────────────────────────────────────
// Returns all active (scheduled/in_progress) matches for the current player
router.get('/my-matches', verifyToken, async (req, res) => {
  try {
    const playerId = req.user.id;

    // Find all registrations where this player is in the roster
    const registrations = await Registration.find({
      'roster.player': playerId,
      status: { $in: ['approved', 'checked_in'] },
    })
      .select('tournament team')
      .lean();

    if (registrations.length === 0) {
      return res.json({ matches: [], count: 0 });
    }

    const tournamentIds = registrations.map(r => r.tournament);
    const teamIds = registrations.map(r => r.team);

    // Find active matches in those tournaments involving the player's teams
    const matches = await Match.find({
      tournament: { $in: tournamentIds },
      status: { $in: ['scheduled', 'in_progress'] },
      $or: [
        { 'vsResults.teamA': { $in: teamIds } },
        { 'vsResults.teamB': { $in: teamIds } },
        { 'results.team': { $in: teamIds } },
      ],
    })
      .populate('tournament', 'tournamentName gameTitle orgLogo orgName')
      .populate('vsResults.teamA', 'teamName teamTag logo')
      .populate('vsResults.teamB', 'teamName teamTag logo')
      .sort({ scheduledStartTime: 1 })
      .lean();

    // Enrich with the player's team info
    const enriched = matches.map(match => {
      const playerTeamId = teamIds.find(tid => {
        const tStr = tid.toString();
        return (
          (match.vsResults?.teamA?._id?.toString() === tStr) ||
          (match.vsResults?.teamB?._id?.toString() === tStr)
        );
      });

      return {
        ...match,
        _playerTeamId: playerTeamId?.toString() || null,
      };
    });

    res.json({ matches: enriched, count: enriched.length });
  } catch (error) {
    console.error('Error fetching player matches:', error);
    res.status(500).json({ error: 'Failed to fetch active matches' });
  }
});

// ─── GET /api/match-rooms/:matchId/messages ───────────────────────────────────────
// Fetch message history — only participants may read
router.get('/:matchId/messages', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { before, limit = 50 } = req.query;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ error: 'Invalid matchId' });
    }

    const match = await Match.findById(matchId).select('tournament vsResults').lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });

    try {
      await assertMatchRoomParticipant(userId, req.user.role, matchId);
    } catch (err) {
      return res.status(err.statusCode || 403).json({ error: err.message });
    }

    const query = { match: matchId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await MatchRoomMessage.find(query)
      .populate('sender', 'username profilePicture inGameName orgName orgLogo')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .lean();

    // Return in chronological order
    res.json({
      messages: messages.reverse(),
      count: messages.length,
      hasMore: messages.length >= parseInt(limit, 10),
    });
  } catch (error) {
    console.error('Error fetching match room messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ─── POST /api/match-rooms/:matchId/messages ──────────────────────────────────
// Send a message to the match room (REST fallback for WebSocket)
router.post('/:matchId/messages', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;
    const senderId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    const match = await Match.findById(matchId).select('tournament status vsResults').lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });

    try {
      await assertMatchRoomParticipant(senderId, req.user.role, matchId);
    } catch (err) {
      return res.status(err.statusCode || 403).json({ error: err.message });
    }

    const msg = await MatchRoomMessage.create({
      match: matchId,
      sender: senderId,
      senderModel: req.user.role === 'organization' ? 'Organization' : 'Player',
      message: message.trim(),
      messageType: 'text',
    });

    const populated = await MatchRoomMessage.findById(msg._id)
      .populate('sender', 'username profilePicture inGameName orgName orgLogo')
      .lean();

    // Broadcast via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`matchRoom:${matchId}`).emit('matchRoom:message', populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error sending match room message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ─── POST /api/match-rooms/:matchId/system-message ────────────────────────────
// Send a system message (internal use by veto/result updates)
// System sender sentinel — a well-known zero ObjectId so populate returns null cleanly
const SYSTEM_SENDER_ID = mongoose.Types.ObjectId.createFromHexString('000000000000000000000000');

export async function createSystemMessage(matchId, message, messageType = 'system', metadata = null, io = null) {
  try {
    const msg = await MatchRoomMessage.create({
      match: matchId,
      sender: SYSTEM_SENDER_ID,
      senderModel: 'Player',
      message,
      messageType,
      metadata,
    });

    if (io) {
      io.to(`matchRoom:${matchId}`).emit('matchRoom:message', {
        ...msg.toObject(),
        sender: { username: 'System', profilePicture: null },
      });
    }

    return msg;
  } catch (error) {
    console.error('Error creating system message:', error);
  }
}

export default router;
