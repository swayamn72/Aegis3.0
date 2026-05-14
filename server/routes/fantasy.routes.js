import express from 'express';
import mongoose from 'mongoose';
import FantasyContest from '../models/fantasyContest.model.js';
import FantasySquad from '../models/fantasySquad.model.js';
import FantasyPlayerPool from '../models/fantasyPlayerPool.model.js';
import { verifyAdminToken } from '../middleware/adminAuth.js';
import auth from '../middleware/auth.js';
import { scoreMatchForContest, scoreEntireContest } from '../services/fantasyScoring.service.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

// ===================== ADMIN ROUTES =====================

// Create contest
router.post('/contests', verifyAdminToken, limiter, async (req, res) => {
  try {
    const contest = await FantasyContest.create({ ...req.body, createdBy: req.admin.adminId });
    res.status(201).json({ message: 'Contest created', contest });
  } catch (error) {
    console.error('Create contest error:', error);
    res.status(500).json({ error: error.message || 'Failed to create contest' });
  }
});

// Update contest
router.put('/contests/:id', verifyAdminToken, limiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const contest = await FantasyContest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    res.json({ message: 'Contest updated', contest });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update contest' });
  }
});

// Update contest status
router.patch('/contests/:id/status', verifyAdminToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { status } = req.body;
    if (!['draft', 'upcoming', 'live', 'scoring', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const contest = await FantasyContest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    // Lock all squads when going live
    if (status === 'live') await FantasySquad.updateMany({ contest: contest._id }, { $set: { status: 'locked' } });

    res.json({ message: 'Status updated', contest });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Set/update player pool
router.post('/contests/:id/player-pool', verifyAdminToken, limiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const contest = await FantasyContest.findById(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    const { players } = req.body; // [{ player, team, displayName, teamTag, inGameRole, profilePicture, cost }]
    if (!Array.isArray(players)) return res.status(400).json({ error: 'players array required' });

    const ops = players.map(p => ({
      updateOne: {
        filter: { contest: contest._id, player: p.player },
        update: { $set: { ...p, contest: contest._id } },
        upsert: true,
      },
    }));
    if (ops.length > 0) await FantasyPlayerPool.bulkWrite(ops);
    res.json({ message: `${ops.length} players set in pool` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set player pool' });
  }
});

// Trigger scoring for a specific match
router.post('/contests/:id/score', verifyAdminToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { matchId } = req.body;
    let result;
    if (matchId && isValidId(matchId)) {
      result = await scoreMatchForContest(req.params.id, matchId);
    } else {
      result = await scoreEntireContest(req.params.id);
    }
    const io = req.app.get('io');
    if (io) io.to(`fantasy:${req.params.id}`).emit('fantasy:scored', { contestId: req.params.id, ...result });
    res.json({ message: 'Scoring complete', ...result });
  } catch (error) {
    console.error('Score error:', error);
    res.status(500).json({ error: error.message || 'Scoring failed' });
  }
});

// Admin list all contests
router.get('/admin/contests', verifyAdminToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    const skip = (Math.max(1, +page) - 1) * Math.min(50, +limit);
    const [contests, total] = await Promise.all([
      FantasyContest.find(query).sort({ createdAt: -1 }).skip(skip).limit(+limit).populate('tournament', 'tournamentName shortName').lean(),
      FantasyContest.countDocuments(query),
    ]);
    res.json({ contests, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// ===================== USER ROUTES =====================

// List contests (public - upcoming/live)
router.get('/contests', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { status: { $in: status ? [status] : ['upcoming', 'live', 'completed'] } };
    const skip = (Math.max(1, +page) - 1) * Math.min(50, +limit);
    const [contests, total] = await Promise.all([
      FantasyContest.find(query).sort({ lockTime: 1 }).skip(skip).limit(+limit).populate('tournament', 'tournamentName shortName media').lean(),
      FantasyContest.countDocuments(query),
    ]);
    res.json({ contests, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// Featured contests (public)
router.get('/featured', async (req, res) => {
  try {
    const contests = await FantasyContest.find({ status: { $in: ['upcoming', 'live'] } })
      .sort({ lockTime: 1 }).limit(5).populate('tournament', 'tournamentName shortName media').lean();
    res.json({ contests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured' });
  }
});

// Contest details + player pool
router.get('/contests/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const contest = await FantasyContest.findById(req.params.id).populate('tournament', 'tournamentName shortName media tier region');
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    const playerPool = await FantasyPlayerPool.find({ contest: contest._id }).populate('player', 'realName profilePicture gameIds aegisRating').populate('team', 'teamName teamTag logo').lean();
    res.json({ contest, playerPool });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contest' });
  }
});

// Create squad
router.post('/contests/:id/squad', auth, limiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const contest = await FantasyContest.findById(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    if (new Date() >= contest.lockTime) return res.status(400).json({ error: 'Contest is locked' });
    if (contest.currentSquads >= contest.maxSquads) return res.status(400).json({ error: 'Contest is full' });

    // Check if user already has a squad
    const existing = await FantasySquad.findOne({ contest: contest._id, user: req.user.id });
    if (existing) return res.status(409).json({ error: 'You already have a squad in this contest', squad: existing });

    const { squadName, players } = req.body;
    if (!Array.isArray(players) || players.length !== contest.squadSize) {
      return res.status(400).json({ error: `Exactly ${contest.squadSize} players required` });
    }

    // Validate captain/VC
    const captains = players.filter(p => p.role === 'captain');
    const vcs = players.filter(p => p.role === 'vice_captain');
    if (captains.length !== 1 || vcs.length !== 1) {
      return res.status(400).json({ error: 'Exactly 1 captain and 1 vice-captain required' });
    }

    // Validate budget and team limits
    let totalCost = 0;
    const teamCounts = {};
    for (const p of players) {
      const poolEntry = await FantasyPlayerPool.findOne({ contest: contest._id, player: p.player });
      if (!poolEntry) return res.status(400).json({ error: `Player ${p.player} not in contest pool` });
      totalCost += poolEntry.cost;
      const tid = poolEntry.team?.toString() || 'unknown';
      teamCounts[tid] = (teamCounts[tid] || 0) + 1;
      if (teamCounts[tid] > contest.maxFromSameTeam) {
        return res.status(400).json({ error: `Max ${contest.maxFromSameTeam} players from the same team` });
      }
      p.cost = poolEntry.cost;
      p.team = poolEntry.team;
    }
    if (totalCost > contest.budgetCap) {
      return res.status(400).json({ error: `Budget exceeded: ${totalCost}/${contest.budgetCap}` });
    }

    const squad = await FantasySquad.create({
      contest: contest._id, user: req.user.id, squadName: squadName || 'My Squad',
      players, budgetUsed: totalCost, status: 'active',
    });

    await FantasyContest.findByIdAndUpdate(contest._id, { $inc: { currentSquads: 1 } });
    res.status(201).json({ message: 'Squad created', squad });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You already have a squad in this contest' });
    console.error('Create squad error:', error);
    res.status(500).json({ error: error.message || 'Failed to create squad' });
  }
});

// Update squad (before lock)
router.put('/contests/:id/squad', auth, limiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const contest = await FantasyContest.findById(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    if (new Date() >= contest.lockTime) return res.status(400).json({ error: 'Contest is locked' });

    const squad = await FantasySquad.findOne({ contest: contest._id, user: req.user.id });
    if (!squad) return res.status(404).json({ error: 'No squad found' });
    if (squad.status === 'locked') return res.status(400).json({ error: 'Squad is locked' });

    const { squadName, players } = req.body;
    if (squadName) squad.squadName = squadName;
    if (players) {
      if (players.length !== contest.squadSize) return res.status(400).json({ error: `Exactly ${contest.squadSize} players required` });
      let totalCost = 0;
      for (const p of players) {
        const poolEntry = await FantasyPlayerPool.findOne({ contest: contest._id, player: p.player });
        if (!poolEntry) return res.status(400).json({ error: `Player ${p.player} not in pool` });
        p.cost = poolEntry.cost;
        p.team = poolEntry.team;
        totalCost += poolEntry.cost;
      }
      if (totalCost > contest.budgetCap) return res.status(400).json({ error: `Budget exceeded` });
      squad.players = players;
      squad.budgetUsed = totalCost;
    }
    await squad.save();
    res.json({ message: 'Squad updated', squad });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update squad' });
  }
});

// Get my squad
router.get('/contests/:id/my-squad', auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const squad = await FantasySquad.findOne({ contest: req.params.id, user: req.user.id })
      .populate('players.player', 'realName profilePicture gameIds aegisRating')
      .populate('players.team', 'teamName teamTag logo');
    if (!squad) return res.status(404).json({ error: 'No squad found' });
    res.json({ squad });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch squad' });
  }
});

// Leaderboard
router.get('/contests/:id/leaderboard', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const [squads, total] = await Promise.all([
      FantasySquad.find({ contest: req.params.id }).sort({ totalPoints: -1 }).skip(skip).limit(+limit)
        .populate('user', 'username profilePicture').lean(),
      FantasySquad.countDocuments({ contest: req.params.id }),
    ]);
    res.json({ leaderboard: squads, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// My contest history
router.get('/my-contests', auth, async (req, res) => {
  try {
    const squads = await FantasySquad.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50)
      .populate({ path: 'contest', select: 'name status tournament phase lockTime entryType', populate: { path: 'tournament', select: 'tournamentName shortName' } }).lean();
    res.json({ contests: squads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
