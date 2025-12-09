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
    const userId = req.user.id.toString();

    const [sentTo, receivedFrom] = await Promise.all([
      ChatMessage.find({ senderId: userId }).distinct("receiverId"),
      ChatMessage.find({ receiverId: userId }).distinct("senderId"),
    ]);

    const chatUserIds = [
      ...new Set([...sentTo, ...receivedFrom].map(id => id.toString()))
    ].filter(id => id !== userId);

    if (chatUserIds.length === 0) {
      return res.json({ users: [] });
    }

    const players = await Player.find({ _id: { $in: chatUserIds } })
      .select("username profilePicture realName primaryGame aegisRating")
      .lean();

    const chatUsers = players
      .map(p => ({
        _id: p._id,
        username: p.username,
        realName: p.realName,
        profilePicture: p.profilePicture,
        primaryGame: p.primaryGame,
        aegisRating: p.aegisRating,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));

    res.json({ users: chatUsers });
  } catch (err) {
    console.error("Error in users/with-chats:", err);
    res.status(500).json({ message: "Server error fetching chat users" });
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

export default router;
