import express from "express";
import mongoose from "mongoose";
import ChatMessage from "../models/chat.model.js";
import Player from "../models/player.model.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes

// GET /api/chat/users/with-chats
router.get("/users/with-chats", auth, async (req, res) => {
  try {
    const userId = req.user.id;

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
          mongoose.Types.ObjectId.isValid(id)
        );
      });

    // Check if user has system messages
    const hasSystemMessages = await ChatMessage.exists({ senderId: 'system', receiverId: userId });

    // Query Player model with valid ObjectIds only
    const users = await Player.find({
      _id: { $in: userIds },
    })
      .select("username inGameName profilePicture aegisRating")
      .lean();

    // If system messages exist, add a pseudo-user for 'system'
    if (hasSystemMessages) {
      users.unshift({
        _id: 'system',
        username: 'System',
        inGameName: 'System',
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

    res.json(messages.reverse());
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

    // Verify tournament exists (only fetch needed fields)
    const tournament = await Tournament.findById(tournamentId)
      .select('tournamentName')
      .lean();

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Create tournament reference message
    const message = new ChatMessage({
      senderId: req.user.id,
      receiverId: captainId,
      message: `Check out this tournament: ${tournament.tournamentName}`,
      messageType: 'tournament_reference',
      tournamentId: tournamentId,
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
    const { message, messageType, tournamentId, matchId, receiverId, senderId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    // Allow system messages if senderId is 'system', otherwise use req.user.id
    const actualSenderId = senderId === 'system' ? 'system' : req.user.id;

    // Create notification message
    const notificationMessage = new ChatMessage({
      senderId: actualSenderId,
      receiverId: receiverId,
      message: message,
      messageType: messageType || 'text',
      tournamentId: tournamentId,
      matchId: matchId,
      timestamp: new Date()
    });

    await notificationMessage.save();

    // Emit to receiver
    if (global.io) {
      global.io.to(receiverId).emit('receiveMessage', {
        _id: notificationMessage._id,
        senderId: actualSenderId,
        receiverId: receiverId,
        message: message,
        messageType: messageType || 'text',
        tournamentId: tournamentId,
        matchId: matchId,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Notification sent successfully', chatMessage: notificationMessage });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Server error sending notification' });
  }
});

export default router;
