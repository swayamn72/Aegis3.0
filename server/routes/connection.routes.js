// GET /api/connections
import express from 'express';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import Player from '../models/player.model.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const playerId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // pagination params (clients can request more if they want)
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '25', 10), 100)); // clamp 1..100
    const pendingLimit = Math.max(1, Math.min(parseInt(req.query.pendingLimit || '10', 10), 100));

    // Fetch only the IDs + counts first to avoid pulling huge arrays into memory
    const player = await Player.findById(playerId)
      .select('connections receivedRequests') // keep minimal
      .lean();

    if (!player) return res.status(404).json({ message: 'User not found' });

    // total counts (cheap since arrays are on the doc)
    const totalConnections = Array.isArray(player.connections) ? player.connections.length : 0;
    const totalPending = Array.isArray(player.receivedRequests) ? player.receivedRequests.length : 0;

    // If there are no ids, return quickly
    if (totalConnections === 0 && totalPending === 0) {
      return res.json({
        connections: [],
        pendingRequests: [],
        meta: { totalConnections: 0, totalPending: 0 }
      });
    }

    // Fetch the actual connection documents but limited & projected (fast)
    const connectionIds = (player.connections || []).slice(0, limit);
    const pendingIds = (player.receivedRequests || []).slice(0, pendingLimit);

    // Parallel fetch for better perf
    const [connections, pendingRequests] = await Promise.all([
      Player.find({ _id: { $in: connectionIds } })
        .select('username profilePicture realName primaryGame aegisRating location') // only required fields
        .lean(),
      Player.find({ _id: { $in: pendingIds } })
        .select('username profilePicture realName primaryGame aegisRating')
        .lean()
    ]);

    // Preserve order of ids (optional): sort arrays to match original order
    const mapById = (arr) => {
      const m = new Map(arr.map(a => [String(a._id), a]));
      return idList => idList.map(id => m.get(String(id))).filter(Boolean);
    };

    const orderedConnections = mapById(connections)(connectionIds);
    const orderedPending = mapById(pendingRequests)(pendingIds);

    res.json({
      connections: orderedConnections,
      pendingRequests: orderedPending,
      meta: {
        totalConnections,
        totalPending,
        returnedConnections: orderedConnections.length,
        returnedPending: orderedPending.length,
        limit, pendingLimit
      }
    });
  } catch (err) {
    console.error('GET /api/connections error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;