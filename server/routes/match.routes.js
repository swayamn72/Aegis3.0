import express from 'express';
import auth from '../middleware/auth.js';
import Match from '../models/match.model.js';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get all matches for a tournament
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { 
      status, 
      phase, 
      limit = 20,  // Reduced from 50
      offset = 0,  // NEW: For pagination
      mobile = 'false' // NEW: Mobile flag
    } = req.query;

    const filter = { tournament: tournamentId };
    if (status) filter.status = status;
    if (phase) filter.tournamentPhase = phase;

    // Count total matches for pagination
    const totalMatches = await Match.countDocuments(filter);

    let matchQuery = Match.find(filter)
      .sort({ scheduledStartTime: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    // Conditional population based on mobile
    if (mobile === 'true') {
      matchQuery = matchQuery
        .populate({
          path: 'participatingTeams.team',
          select: 'teamName teamTag logo' // Only essential fields
        })
        .populate('tournament', 'tournamentName shortName');
    } else {
      matchQuery = matchQuery
        .populate({
          path: 'participatingTeams.team',
          select: 'teamName teamTag logo'
        })
        .populate('tournament', 'tournamentName shortName');
    }

    const matches = await matchQuery.lean();

    res.json({ 
      matches,
      pagination: {
        total: totalMatches,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalMatches
      }
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

export default router;