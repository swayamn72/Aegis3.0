import express from 'express';
import auth from '../middleware/auth.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import Match from '../models/match.model.js';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import Registration from '../models/registration.model.js';
import mongoose from 'mongoose';

const router = express.Router();

// Helper function to calculate placement points
const getPlacementPoints = (position) => {
  if (!position) return 0;
  const pointsMap = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3,
    6: 2, 7: 1, 8: 1, 9: 0, 10: 0
  };
  return pointsMap[position] || 0;
};

// Middleware to verify tournament ownership
const verifyTournamentOwnership = async (req, res, next) => {
  try {
    if (!req.organization || !req.organization._id) {
      return res.status(401).json({ error: 'Organization authentication required' });
    }

    const tournamentId = req.body.tournament || req.params.tournamentId;

    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }

    const tournament = await Tournament.findById(tournamentId).select('organizer.organizationRef').lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.organizer?.organizationRef) {
      return res.status(500).json({ error: 'Tournament configuration error: missing organization reference' });
    }

    if (tournament.organizer.organizationRef.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'You are not authorized to perform this action' });
    }

    next();
  } catch (error) {
    console.error('Error verifying tournament ownership:', error);
    res.status(500).json({ error: 'Failed to verify tournament ownership' });
  }
};

// Middleware to verify match ownership (via tournament)
const verifyMatchOwnership = async (req, res, next) => {
  try {
    if (!req.organization || !req.organization._id) {
      console.error('No organization in request');
      return res.status(401).json({ error: 'Organization authentication required' });
    }

    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await Match.findById(matchId).select('tournament').lean();

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const tournament = await Tournament.findById(match.tournament).select('organizer.organizationRef').lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.organizer?.organizationRef) {
      console.error('Tournament has no organizationRef:', tournament);
      return res.status(500).json({ error: 'Tournament configuration error: missing organization reference' });
    }

    const tournamentOrgId = tournament.organizer.organizationRef.toString();
    const requestOrgId = req.organization._id.toString();

    if (tournamentOrgId !== requestOrgId) {
      return res.status(403).json({ error: 'You are not authorized to perform this action' });
    }

    next();
  } catch (error) {
    console.error('Error verifying match ownership:', error);
    res.status(500).json({ error: 'Failed to verify match ownership' });
  }
};

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
router.post('/schedule', verifyOrgToken, verifyTournamentOwnership, async (req, res) => {
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

// Share room credentials for a match (OPTIMIZED)
router.post('/:matchId/share-credentials', verifyOrgToken, verifyMatchOwnership, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { roomId, password } = req.body;

    // Validation
    if (!roomId || !password) {
      return res.status(400).json({ error: 'Room ID and password are required' });
    }

    // Validate format
    if (roomId.trim().length < 3) {
      return res.status(400).json({
        error: 'Room ID must be at least 3 characters'
      });
    }

    // Fetch match with minimal data
    const match = await Match.findById(matchId)
      .select('roomCredentials participatingTeams tournament tournamentPhase matchNumber')
      .populate('tournament', 'tournamentName logo')
      .lean();

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if credentials already shared
    if (match.roomCredentials?.sharedAt) {
      return res.status(409).json({
        error: 'Credentials already shared',
        sharedAt: match.roomCredentials.sharedAt
      });
    }

    // NEW: Get all registered teams for this match from Registration collection
    // This ensures we only notify teams that are actually registered
    const teamIds = match.participatingTeams.map(pt => pt.team);

    const [registrations, players] = await Promise.all([
      // Get registrations to verify teams are active
      Registration.find({
        tournament: match.tournament._id || match.tournament,
        team: { $in: teamIds },
        status: { $in: ['approved', 'checked_in'] }
      })
        .select('team')
        .lean(),

      // Get all players from participating teams
      Player.find({
        team: { $in: teamIds }
      })
        .select('_id username email team')
        .lean()
    ]);

    // Filter to only registered teams
    const registeredTeamIds = new Set(
      registrations.map(r => r.team.toString())
    );

    // Filter players to only those in registered teams
    const eligiblePlayers = players.filter(p =>
      p.team && registeredTeamIds.has(p.team.toString())
    );

    if (eligiblePlayers.length === 0) {
      return res.status(400).json({
        error: 'No eligible players found for this match'
      });
    }

    // Update match with room credentials
    await Match.updateOne(
      { _id: matchId },
      {
        $set: {
          'roomCredentials.roomId': roomId.trim(),
          'roomCredentials.password': password.trim(),
          'roomCredentials.sharedAt': new Date(),
          'roomCredentials.sharedBy': req.user?.id || null
        }
      }
    );

    // Prepare notification data
    const tournamentName = match.tournament?.tournamentName || 'Unknown Tournament';
    const tournamentPhase = match.tournamentPhase || 'Unknown Phase';
    const matchNumber = match.matchNumber || 'Unknown';
    const tournamentLogo = match.tournament?.logo || null;

    // Import ChatMessage model
    const ChatMessage = (await import('../models/chat.model.js')).default;

    // Create message content
    const messageContent = `🎮 Room Credentials for Match #${matchNumber}

📋 Tournament: ${tournamentName}
🎯 Phase: ${tournamentPhase}

🔑 Room ID: ${roomId}
🔐 Password: ${password}

⏰ Match starts soon. Good luck!`;

    // Batch insert messages (optimized)
    const messages = eligiblePlayers.map(player => ({
      senderId: 'system',
      receiverId: player._id,
      message: messageContent,
      messageType: 'system',
      tournamentId: match.tournament?._id || match.tournament,
      matchId: match._id,
      timestamp: new Date(),
      ...(tournamentLogo && { tournamentLogo })
    }));

    // Insert all messages at once
    const savedMessages = await ChatMessage.insertMany(messages, { ordered: false });

    // Emit socket notifications in batch
    if (global.io) {
      const notifications = savedMessages.map((msg, index) => ({
        player: eligiblePlayers[index],
        message: {
          _id: msg._id,
          senderId: 'system',
          receiverId: eligiblePlayers[index]._id.toString(),
          message: msg.message,
          messageType: 'system',
          tournamentId: match.tournament?._id || match.tournament,
          matchId: match._id,
          timestamp: msg.timestamp,
          tournamentLogo
        }
      }));

      // Emit all notifications
      notifications.forEach(({ player, message }) => {
        global.io.to(player._id.toString()).emit('receiveMessage', message);
      });

      // Also emit a broadcast to the match room if you have rooms
      global.io.to(`match_${matchId}`).emit('credentialsShared', {
        matchId: match._id,
        roomId: roomId.trim(),
        sharedAt: new Date()
      });
    }

    // Optional: Send email notifications to players
    try {
      // Only if you have email service set up
      if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
        const emailPromises = eligiblePlayers
          .filter(p => p.email)
          .map(player =>
            sendEmail(
              player.email,
              `Match #${matchNumber} Room Credentials - ${tournamentName}`,
              `Room ID: ${roomId}\nPassword: ${password}\n\nGood luck!`
            ).catch(err => console.error(`Email failed for ${player.email}:`, err))
          );

        await Promise.allSettled(emailPromises);
      }
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // Don't fail the request if emails fail
    }

    // Log the action for audit trail
    console.log(`✅ Room credentials shared for Match #${matchNumber} (${matchId})`);
    console.log(`   Players notified: ${eligiblePlayers.length}`);
    console.log(`   Shared by: ${req.user?.username || 'System'}`);

    res.json({
      success: true,
      message: 'Room credentials shared successfully',
      stats: {
        playersNotified: eligiblePlayers.length,
        teamsNotified: registeredTeamIds.size,
        messagesCreated: savedMessages.length
      },
      roomCredentials: {
        roomId: roomId.trim(),
        sharedAt: new Date(),
        sharedBy: req.user?.id || null
      }
    });

  } catch (error) {
    console.error('❌ Error sharing room credentials:', error);

    // Handle specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      error: 'Failed to share room credentials',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update match results
router.put('/:matchId/results', verifyOrgToken, verifyMatchOwnership, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { results } = req.body;

    console.log('Received results update for match:', matchId);
    console.log('Results data:', JSON.stringify(results, null, 2));

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Update participating teams with results
    if (results && results.length > 0) {
      for (const result of results) {
        const teamIndex = match.participatingTeams.findIndex(
          team => team.team.toString() === result.teamId
        );

        if (teamIndex !== -1) {
          // Calculate placement points based on position
          const placementPoints = getPlacementPoints(result.position);

          match.participatingTeams[teamIndex].finalPosition = result.position;
          match.participatingTeams[teamIndex].kills.total = result.kills || 0;
          match.participatingTeams[teamIndex].points.placementPoints = placementPoints;
          match.participatingTeams[teamIndex].points.killPoints = result.kills || 0;
          match.participatingTeams[teamIndex].points.totalPoints = placementPoints + (result.kills || 0);

          // Mark as chicken dinner if position 1
          if (result.position === 1) {
            match.participatingTeams[teamIndex].chickenDinner = true;
          }
        } else {
          console.error('Team not found in participating teams:', result.teamId);
        }
      }
    }

    // Keep match status as in_progress to allow further editing
    match.status = 'in_progress';

    await match.save();
    await match.populate('participatingTeams.team', 'teamName teamTag logo');

    console.log('Updated match:', match._id);
    res.json(match);
  } catch (error) {
    console.error('Error updating match results:', error);
    res.status(500).json({ error: 'Failed to update match results' });
  }
});

export default router;