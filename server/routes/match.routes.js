import express from 'express';
import auth from '../middleware/auth.js';
import Match from '../models/match.model.js';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get scheduled matches for a tournament
router.get('/scheduled/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const matches = await Match.find({
      tournament: tournamentId,
      status: 'scheduled'
    })
      .populate({
        path: 'participatingTeams.team',
        select: 'teamName teamTag logo'
      })
      .populate('tournament', 'tournamentName shortName')
      .sort({ scheduledStartTime: 1 })
      .lean();

    res.json({ matches });
  } catch (error) {
    console.error('Error fetching scheduled matches:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled matches' });
  }
});

// Get scheduled matches for a tournament
router.get('/scheduled/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const matches = await Match.find({
      tournament: tournamentId,
      status: 'scheduled'
    })
      .populate({
        path: 'participatingTeams.team',
        select: 'teamName teamTag logo'
      })
      .populate('tournament', 'tournamentName shortName')
      .sort({ scheduledStartTime: 1 })
      .lean();

    res.json({ matches });
  } catch (error) {
    console.error('Error fetching scheduled matches:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled matches' });
  }
});

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

// Schedule a new match
router.post('/schedule', async (req, res) => {
  try {
    const matchData = req.body;

    console.log('Scheduling match data:', JSON.stringify(matchData, null, 2));

    // Validate tournament exists
    const tournament = await Tournament.findById(matchData.tournament);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Validate phase exists in tournament
    const phase = tournament.phases?.find(p => p.name === matchData.tournamentPhase);
    if (!phase) {
      return res.status(400).json({ error: 'Invalid tournament phase' });
    }

    // Normalize incoming group ids to strings
    const selectedGroupIds = (matchData.participatingGroups || []).map(g => g?.toString());

    // Collect teams from selected groups (match by _id or name)
    const teamsFromGroups = selectedGroupIds.flatMap(groupId => {
      const group = phase.groups?.find(g =>
        g?._id?.toString() === groupId ||
        g?.id?.toString?.() === groupId ||
        g?.name === groupId
      );
      return group?.teams || [];
    });

    // Remove duplicates and normalize team ids to strings
    const uniqueTeamIds = [...new Set(teamsFromGroups.map(t => t?.toString()))];

    // Create participatingTeams array with just team references
    const participatingTeams = uniqueTeamIds.map(teamId => ({
      team: teamId,
      finalPosition: null,
      points: { placementPoints: 0, killPoints: 0, totalPoints: 0 },
      kills: { total: 0, breakdown: [] },
      chickenDinner: false
    }));

    // Get the next match number for this tournament
    const lastMatch = await Match.findOne({ tournament: matchData.tournament })
      .sort({ matchNumber: -1 })
      .select('matchNumber');
    const nextMatchNumber = lastMatch ? lastMatch.matchNumber + 1 : 1;

    // Create the match with scheduled status and persist participatingGroups
    const scheduledMatch = new Match({
      ...matchData,
      participatingTeams,
      participatingGroups: selectedGroupIds,
      matchNumber: nextMatchNumber,
      status: 'scheduled',
      matchType: 'scheduled'
    });

    await scheduledMatch.save();

    // Update the tournament's phase to include this match
    if (tournament) {
      const phase = tournament.phases?.find(p => p.name === matchData.tournamentPhase);
      if (phase) {
        phase.matches.push(scheduledMatch._id);
        await tournament.save();
      }
    }

    // Populate the saved match for response
    await scheduledMatch.populate('participatingTeams.team', 'teamName teamTag logo');
    await scheduledMatch.populate('tournament', 'tournamentName');

    // Send notification to all participating teams' players
    const teams = await Team.find({ _id: { $in: uniqueTeamIds } }).populate('players', 'username');
    const allPlayers = teams.flatMap(team => team.players);

    for (const player of allPlayers) {
      const ChatMessage = (await import('../models/chat.model.js')).default;
      const notificationMessage = new ChatMessage({
        senderId: 'system',
        receiverId: player._id.toString(),
        message: `Match scheduled: ${matchData.matchName} in ${tournament.tournamentName} - ${matchData.tournamentPhase} at ${new Date(matchData.scheduledStartTime).toLocaleString()}`,
        messageType: 'match_scheduled',
        tournamentId: matchData.tournament,
        matchId: scheduledMatch._id,
        timestamp: new Date()
      });

      await notificationMessage.save();

      // Emit to player via socket
      if (global.io) {
        global.io.to(player._id.toString()).emit('receiveMessage', {
          _id: notificationMessage._id,
          senderId: 'system',
          receiverId: player._id.toString(),
          message: notificationMessage.message,
          messageType: 'match_scheduled',
          tournamentId: matchData.tournament,
          matchId: scheduledMatch._id,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json(scheduledMatch);

  } catch (error) {
    console.error('Error scheduling match:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: 'Validation error', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to schedule match', details: error.message });
    }
  }
});

export default router;