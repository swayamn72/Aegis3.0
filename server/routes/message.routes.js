import express from "express";
import mongoose from "mongoose";
import ChatMessage from "../models/chat.model.js";
import Player from "../models/player.model.js";
import Tournament from "../models/tournament.model.js";
import DirectMessageRequest from '../models/directMessageRequest.model.js';
import auth from "../middleware/auth.js";
import notificationService from '../services/notification.service.js';
import { getBlockedUserIdSetForUser, isEitherUserBlocked } from '../utils/blockUtils.js';
import { ensurePendingMessageRequest, getMessageRequestRelationship } from '../utils/directMessageRequestUtils.js';

const router = express.Router();

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes

// GET /api/chat/requests/incoming
router.get('/requests/incoming', auth, async (req, res) => {
  try {
    const requests = await DirectMessageRequest.find({
      recipient: req.user.id,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .populate('requester', '_id username realName profilePicture aegisRating inGameRole')
      .lean();

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching incoming message requests:', error);
    res.status(500).json({ message: 'Failed to fetch incoming message requests' });
  }
});

// GET /api/chat/requests/outgoing
router.get('/requests/outgoing', auth, async (req, res) => {
  try {
    const requests = await DirectMessageRequest.find({
      requester: req.user.id,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .populate('recipient', '_id username realName profilePicture aegisRating inGameRole')
      .lean();

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching outgoing message requests:', error);
    res.status(500).json({ message: 'Failed to fetch outgoing message requests' });
  }
});

// GET /api/chat/requests/relationship/:targetUserId
router.get('/requests/relationship/:targetUserId', auth, async (req, res) => {
  try {
    const targetUserId = req.params.targetUserId;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid target user ID' });
    }

    if (req.user.id.toString() === targetUserId.toString()) {
      return res.json({
        canMessage: false,
        status: 'self',
        requestId: null,
      });
    }

    const isBlocked = await isEitherUserBlocked(req.user.id, targetUserId);
    if (isBlocked) {
      return res.json({
        canMessage: false,
        status: 'blocked',
        requestId: null,
      });
    }

    const relationship = await getMessageRequestRelationship(req.user.id, targetUserId);
    res.json(relationship);
  } catch (error) {
    console.error('Error fetching message request relationship:', error);
    res.status(500).json({ message: 'Failed to fetch relationship' });
  }
});

// POST /api/chat/requests/:targetUserId
router.post('/requests/:targetUserId', auth, async (req, res) => {
  try {
    const targetUserId = req.params.targetUserId;
    const initialMessage = (req.body?.initialMessage || '').toString();

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid target user ID' });
    }

    if (req.user.id.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: 'Cannot create a request to yourself' });
    }

    if (await isEitherUserBlocked(req.user.id, targetUserId)) {
      return res.status(403).json({ message: 'This user is not available for messaging', blocked: true });
    }

    const targetExists = await Player.exists({ _id: targetUserId });
    if (!targetExists) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const relationship = await getMessageRequestRelationship(req.user.id, targetUserId);
    if (relationship.canMessage) {
      return res.json({
        message: 'Messaging already enabled',
        status: relationship.status,
        requestId: relationship.requestId,
      });
    }

    const pending = await ensurePendingMessageRequest({
      requesterId: req.user.id,
      recipientId: targetUserId,
      initialMessage,
    });

    if (pending.status === 'pending_received') {
      return res.status(409).json({
        message: 'This player has already requested to message you. Accept their request from chat.',
        status: 'pending_received',
        requestId: pending.request?._id || null,
      });
    }

    res.status(pending.created ? 201 : 200).json({
      message: pending.created ? 'Message request sent' : 'Message request already pending',
      status: pending.status,
      requestId: pending.request?._id || null,
    });
  } catch (error) {
    console.error('Error creating message request:', error);
    res.status(500).json({ message: 'Failed to create message request' });
  }
});

// PATCH /api/chat/requests/:requestId
router.patch('/requests/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Action must be accept or decline' });
    }

    const request = await DirectMessageRequest.findById(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Pending request not found' });
    }

    if (request.recipient.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this request' });
    }

    if (await isEitherUserBlocked(request.requester, request.recipient)) {
      return res.status(403).json({ message: 'This user is not available for messaging', blocked: true });
    }

    request.status = action === 'accept' ? 'accepted' : 'declined';
    request.respondedAt = new Date();
    await request.save();

    res.json({
      message: action === 'accept' ? 'Message request accepted' : 'Message request declined',
      status: request.status,
      requestId: request._id,
    });
  } catch (error) {
    console.error('Error updating message request:', error);
    res.status(500).json({ message: 'Failed to update message request' });
  }
});

// GET /api/chat/users/with-chats
router.get("/users/with-chats", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const blockedSet = await getBlockedUserIdSetForUser(userId);

    // Aggregate direct (non-system) chat users
    const messages = await ChatMessage.aggregate([
      {
        $match: {
          $and: [
            { senderId: { $ne: "system" } },
            {
              $or: [
                { senderId: userId },
                { receiverId: userId },
              ],
            },
          ],
        },
      },
      {
        $project: {
          otherUserId: {
            $cond: {
              if: { $eq: ["$senderId", userId] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
        },
      },
      {
        $group: {
          _id: "$otherUserId",
        },
      },
    ]);

    // Filter out 'system', null, and validate ObjectId
    const userIds = messages
      .map((m) => m._id)
      .filter((id) => {
        return (
          id &&
          id !== "system" &&
          id.toString() !== userId.toString() &&
          mongoose.Types.ObjectId.isValid(id) &&
          !blockedSet.has(id.toString())
        );
      });

    // Check if user has system messages
    const hasSystemMessages = await ChatMessage.exists({ senderId: 'system', receiverId: userId });

    // Query Player model with valid ObjectIds only
    const users = await Player.find({
      _id: { $in: userIds },
    })
      .select("username profilePicture aegisRating")
      .lean();

    // If system messages exist, add a pseudo-user for 'system'
    if (hasSystemMessages) {
      users.unshift({
        _id: 'system',
        username: 'System',
        profilePicture: '',
        aegisRating: null
      });
    }

    res.json({ users });
  } catch (error) {
    console.error("Error in users/with-chats:", error);
    res.status(500).json({ error: "Failed to fetch users with chats" });
  }
});

// GET /api/chat/system
router.get("/system", auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;

    const query = {
      senderId: "system",
      receiverId: req.user.id,
    };

    if (before) {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' timestamp" });
      }
      query.timestamp = { $lt: beforeDate };
    }

    const rawLimit = parseInt(limit, 10);
    const safeLimit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100);

    const messages = await ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(safeLimit)
      .select(
        "senderId receiverId message messageType metadata timestamp invitationId invitationStatus"
      )
      .populate({
        path: "invitationId",
        populate: {
          path: "team",
          select: "teamName teamTag logo primaryGame region",
        },
      })
      .lean();

    res.json(messages.reverse());
  } catch (err) {
    console.error("Error fetching system messages:", err);
    res.status(500).json({ message: "Server error fetching system messages" });
  }
});

// GET /api/chat/:receiverId - MUST be last
router.get("/:receiverId", auth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Invalid receiver ID" });
    }

    const isBlocked = await isEitherUserBlocked(senderId, receiverId);
    if (isBlocked) {
      return res.status(403).json({ message: 'This conversation is no longer available', blocked: true });
    }

    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100);

    const query = {
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    };

    if (req.query.before) {
      const beforeDate = new Date(req.query.before);
      if (isNaN(beforeDate.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' timestamp" });
      }
      query.timestamp = { $lt: beforeDate };
    }

    const messages = await ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .select("senderId receiverId message messageType metadata timestamp invitationId invitationStatus")
      .populate({
        path: "invitationId",
        populate: {
          path: "team",
          select: "teamName teamTag logo primaryGame region",
        },
      })
      .lean();

    const requestGate = await getMessageRequestRelationship(senderId, receiverId);
    res.json({ messages: messages.reverse(), requestGate });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Server error fetching messages" });
  }
});

// ============================================================================
// SEND TOURNAMENT REFERENCE MESSAGE
// ============================================================================

router.post("/tournament-reference/:tournamentId", auth, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { captainId } = req.body;

    if (!captainId) {
      return res.status(400).json({ message: 'Captain ID is required' });
    }

    if (await isEitherUserBlocked(req.user.id, captainId)) {
      return res.status(403).json({ message: 'This user is not available for messaging' });
    }

    // Verify tournament exists and fetch relevant fields
    const tournament = await Tournament.findById(tournamentId)
      .select('tournamentName gameTitle tier region prizePool startDate endDate slots status format media.logo')
      .lean();

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Format dates
    const startDate = new Date(tournament.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const endDate = new Date(tournament.endDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Format prize pool
    const prizePoolText = tournament.prizePool?.total
      ? `💰 Prize Pool: ${tournament.prizePool.currency === 'USD' ? '$' : '₹'}${tournament.prizePool.total.toLocaleString()}`
      : '';

    // Format slots info
    const slotsText = tournament.slots?.total
      ? `👥 Slots: ${tournament.slots.registered || 0}/${tournament.slots.total}`
      : '';

    // Build enhanced message
    const tournamentUrl = `/tournament/${tournamentId}`;
    const messageParts = [
      `🏆 ${tournament.tournamentName}`,
      '',
      `🎮 Game: ${tournament.gameTitle || 'BGMI'}`,
      `📍 Region: ${tournament.region || 'India'} | Tier: ${tournament.tier || 'Community'}`,
      `📅 ${startDate} - ${endDate}`,
      prizePoolText,
      slotsText,
      tournament.format ? `⚔️ Format: ${tournament.format}` : '',
      '',
      `Status: ${tournament.status?.replace(/_/g, ' ').toUpperCase() || 'ANNOUNCED'}`,
      '',
      `[View Tournament](https://aegis.gg${tournamentUrl})`
    ].filter(line => line !== '').join('\n');

    // Create tournament reference message
    const message = new ChatMessage({
      senderId: req.user.id,
      receiverId: captainId,
      message: messageParts,
      messageType: 'tournament_reference',
      tournamentId: tournamentId,
      metadata: {
        tournamentName: tournament.tournamentName,
        logo: tournament.media?.logo || null,
        tier: tournament.tier,
        prizePool: tournament.prizePool?.total || 0,
        currency: tournament.prizePool?.currency || 'INR'
      },
      button: {
        text: 'View Tournament Details',
        url: `https://aegis.gg${tournamentUrl}`
      }
    });

    await message.save();

    res.json({
      message: 'Tournament reference sent to captain',
      chatMessage: message
    });
  } catch (error) {
    console.error('Error sending tournament reference:', error);
    res.status(500).json({ message: 'Server error sending tournament reference' });
  }
});

// Send notification message
router.post("/send-notification", auth, async (req, res) => {
  try {
    const { message, messageType, tournamentId, matchId, receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    if (receiverId === 'system') {
      return res.status(400).json({ message: 'Cannot send messages to system' });
    }

    // Bug #8: Only server-internal routes may use 'system' as senderId.
    // Regular authenticated users always send as themselves.
    const actualSenderId = req.user.id;

    // Bug #9: Validate and trim message content
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    const MAX_MESSAGE_LENGTH = 2000;
    const sanitizedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

    const isBlocked = await isEitherUserBlocked(actualSenderId, receiverId);
    if (isBlocked) {
      return res.status(403).json({ message: 'This user is not available for messaging', blocked: true });
    }

    const relationship = await getMessageRequestRelationship(actualSenderId, receiverId);
    if (!relationship.canMessage) {
      const pending = await ensurePendingMessageRequest({
        requesterId: actualSenderId,
        recipientId: receiverId,
        initialMessage: sanitizedMessage,
      });

      return res.status(403).json({
        message: pending.status === 'pending_received'
          ? 'This player already requested to message you. Accept the request first.'
          : 'Message request required before chatting',
        requestRequired: true,
        requestStatus: pending.status,
        requestId: pending.request?._id || relationship.requestId || null,
      });
    }

    // Create notification message
    const notificationMessage = new ChatMessage({
      senderId: actualSenderId,
      receiverId: receiverId,
      message: sanitizedMessage,
      messageType: messageType || 'text',
      tournamentId: tournamentId,
      matchId: matchId,
      timestamp: new Date()
    });

    await notificationMessage.save();

    // Emit to receiver via socket
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('receiveMessage', {
        _id: notificationMessage._id,
        senderId: actualSenderId,
        receiverId: receiverId,
        message: sanitizedMessage,
        messageType: messageType || 'text',
        tournamentId: tournamentId,
        matchId: matchId,
        timestamp: new Date()
      });
    }

    // Bug #5: Only send push notification if receiver is NOT currently online
    // via socket — consistent with the socket handler in chat.js.
    let receiverIsOnline = false;
    if (io) {
      const receiverRoom = io.sockets.adapter.rooms.get(receiverId);
      receiverIsOnline = receiverRoom && receiverRoom.size > 0;
    }

    if (!receiverIsOnline) {
      const senderName = (await Player.findById(req.user.id).select('username').lean())?.username || 'New message';

      notificationService
        .sendToPlayer(
          receiverId,
          senderName,
          String(sanitizedMessage || ''),
          {
            type: 'chat_message',
            directUserId: req.user.id,
            senderId: req.user.id,
            senderName,
          }
        )
        .catch((err) => {
          console.error('Direct message push notification error:', err);
        });
    }

    res.json({ message: 'Notification sent successfully', chatMessage: notificationMessage });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Server error sending notification' });
  }
});

export default router;
