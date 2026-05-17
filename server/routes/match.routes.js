import express from 'express';
import auth from '../middleware/auth.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import Match from '../models/match.model.js';
import LiveMatchState from '../models/liveMatchState.model.js';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import Registration from '../models/registration.model.js';
import ChatMessage from '../models/chat.model.js';
import mongoose from 'mongoose';
import upload from '../config/multer.js';
import { processScreenshots } from '../services/bgmiOcr.service.js';
import notificationService from '../services/notification.service.js';
import { getGameConfig, isValidMap, isHeadToHead, supportsOcr } from '../config/gameRegistry.js';

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

    const tournament = await Tournament.findById(tournamentId).select('organizer.organizationRef status').lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is concluded and locked.' });
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

    const tournament = await Tournament.findById(match.tournament).select('organizer.organizationRef status').lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is concluded and locked.' });
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
    const { limit = 10, offset = 0 } = req.query;

    const filter = {
      tournament: tournamentId,
      status: 'scheduled'
    };

    const totalMatches = await Match.countDocuments(filter);

    const matches = await Match.find(filter)
      .populate({
        path: 'results.team',
        select: 'teamName teamTag logo'
      })
      .populate('tournament', 'tournamentName shortName')
      .sort({ scheduledStartTime: 1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

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
      group,
      limit = 20,
      offset = 0,
      mobile = 'false'
    } = req.query;

    const filter = { tournament: tournamentId };
    if (status) filter.status = status;
    if (phase) filter.tournamentPhase = phase;
    if (group) {
      if (mongoose.Types.ObjectId.isValid(group)) {
        filter.participatingGroups = group;
      } else {
        // Resolve group name to ID for more robust filtering
        const tournament = await Tournament.findById(tournamentId).select('phases').lean();
        const groupIds = [];
        if (tournament && tournament.phases) {
          tournament.phases.forEach(p => {
            p.groups?.forEach(g => {
              // Match name, "Group Name", or just the number if name is "Group 50"
              const cleanGroupName = (g.name || '').toLowerCase();
              const queryGroup = (group || '').toString().toLowerCase();

              if (cleanGroupName === queryGroup ||
                cleanGroupName === `group ${queryGroup}` ||
                cleanGroupName.replace('group ', '').trim() === queryGroup) {
                groupIds.push(g._id.toString());
              }
            });
          });
        }

        if (groupIds.length > 0) {
          filter.participatingGroups = { $in: groupIds };
        } else {
          // Fallback to direct match (for legacy data or untracked names)
          filter.participatingGroups = group;
        }
      }
    }

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
          path: 'results.team',
          select: 'teamName teamTag logo' // Only essential fields
        })
        .populate('tournament', 'tournamentName shortName phases');
    } else {
      matchQuery = matchQuery
        .populate({
          path: 'results.team',
          select: 'teamName teamTag logo'
        })
        .populate('results.kills.breakdown.player', 'username gameIds inGameName profilePicture')
        .populate('tournament', 'tournamentName shortName phases');
    }

    const matches = await matchQuery.lean();

    // For each match, enhance with group names and teams (if results empty)
    const enhancedMatches = await Promise.all(matches.map(async (match) => {
      const phase = match.tournament?.phases?.find(p => p.name === match.tournamentPhase);

      // Always resolve group names from IDs for display
      if (phase && match.participatingGroups?.length > 0) {
        match.groupNames = match.participatingGroups.map(groupId => {
          const group = phase.groups?.find(g =>
            g?._id?.toString() === groupId ||
            g?.id?.toString?.() === groupId ||
            g?.name === groupId
          );
          return group?.name;
        }).filter(Boolean);
      } else {
        match.groupNames = [];
      }

      // If results is empty (live/scheduled), fetch teams from participatingGroups via Registration
      if (!match.results || match.results.length === 0) {
        if (phase && match.groupNames?.length > 0) {
          const registrations = await Registration.find({
            tournament: match.tournament._id || match.tournament,
            phase: match.tournamentPhase,
            group: { $in: match.groupNames },
            status: { $in: ['approved', 'checked_in'] }
          }).populate('team', 'teamName teamTag logo')
            .populate('roster.player', 'username gameIds inGameName profilePicture')
            .lean();

          // Add teams to match object
          match.teams = registrations.map(reg => ({
            ...reg.team,
            roster: reg.roster
          }));
        }
      }
      return match;
    }));

    res.json({
      matches: enhancedMatches,
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

    // Prevent scheduling if the phase is completed
    if (phase.status === 'completed') {
      return res.status(400).json({
        error: 'Phase is concluded',
        details: 'Cannot schedule new matches in a completed phase.'
      });
    }

    // Normalize incoming group ids to strings
    const selectedGroupIds = (matchData.participatingGroups || []).map(g => g?.toString());

    // Get teams from Registration records based on selected groups
    const groupNames = selectedGroupIds.map(groupId => {
      const group = phase.groups?.find(g =>
        g?._id?.toString() === groupId ||
        g?.id?.toString?.() === groupId ||
        g?.name === groupId
      );
      return group?.name;
    }).filter(Boolean);

    console.log('Selected group names:', groupNames);

    // Query teams from Registrations (single source of truth)
    const registrations = await Registration.find({
      tournament: matchData.tournament,
      phase: matchData.tournamentPhase,
      group: { $in: groupNames },
      status: { $in: ['approved', 'checked_in'] }
    }).select('team');

    const uniqueTeamIds = registrations.map(reg => reg.team.toString());
    console.log('Teams found from registrations:', uniqueTeamIds.length);

    // Get the next match number for this tournament
    const lastMatch = await Match.findOne({ tournament: matchData.tournament })
      .sort({ matchNumber: -1 })
      .select('matchNumber');
    const nextMatchNumber = lastMatch ? lastMatch.matchNumber + 1 : 1;

    // Create the match with scheduled status and persist participatingGroups
    // Teams will be fetched dynamically from participatingGroups when needed
    const gameTitle = tournament.gameTitle || 'BGMI';
    const scheduledMatch = new Match({
      ...matchData,
      gameTitle,
      participatingGroups: selectedGroupIds,
      matchNumber: nextMatchNumber,
      status: 'scheduled',
      matchType: 'scheduled',
      results: [] // Empty results initially (BR); vsResults empty by default (Valorant)
    });

    await scheduledMatch.save();

    // Update the tournament's phase to include this match, and LOCK the participating groups
    if (tournament) {
      const phaseObj = tournament.phases?.find(p => p.name === matchData.tournamentPhase);
      if (phaseObj) {
        phaseObj.matches.push(scheduledMatch._id);

        // Lock every group that this match uses so the org can't reshuffle teams mid-tournament
        if (groupNames.length > 0) {
          phaseObj.groups.forEach(g => {
            if (groupNames.includes(g.name)) g.isLocked = true;
          });
        }

        // --- NEW: Automated Phase Transition ---
        // "No Overlap" Rule: Only flip to in_progress if no other phase is currently in_progress
        const anyOtherPhaseInProgress = tournament.phases.some(
          p => p.status === 'in_progress' && p.name !== matchData.tournamentPhase
        );
        if (phaseObj.status === 'upcoming' && !anyOtherPhaseInProgress) {
          phaseObj.status = 'in_progress';
          console.log(`🚀 Automated Phase Transition: "${phaseObj.name}" set to in_progress`);
        }

        await tournament.save();
      }
    }

    // Populate the saved match for response
    await scheduledMatch.populate('tournament', 'tournamentName');

    // Fetch teams dynamically from participatingGroups for the response
    const teamDetails = await Team.find({ _id: { $in: uniqueTeamIds } })
      .select('teamName teamTag logo')
      .lean();

    // Send notification to all participating teams' players
    console.log('🔔 Sending match notifications to players...');
    console.log('   Unique team IDs:', uniqueTeamIds);

    const teams = await Team.find({ _id: { $in: uniqueTeamIds } }).populate('players', '_id username');
    console.log('   Teams found:', teams.length);

    const allPlayers = teams.flatMap(team => team.players);
    console.log('   Total players:', allPlayers.length);

    if (allPlayers.length > 0) {
      const messageContent = `Match scheduled: ${matchData.matchName} in ${tournament.tournamentName} - ${matchData.tournamentPhase} at ${new Date(matchData.scheduledStartTime).toLocaleString()}`;

      // Build all message documents at once — no loop saves
      const messageDocs = allPlayers.map(player => ({
        senderId: 'system',
        receiverId: player._id,
        message: messageContent,
        messageType: 'match_scheduled',
        tournamentId: matchData.tournament,
        matchId: scheduledMatch._id,
        timestamp: new Date()
      }));

      // Single batch insert instead of N sequential saves
      const savedMessages = await ChatMessage.insertMany(messageDocs, { ordered: false });
      console.log('   ✅ Messages sent:', savedMessages.length);

      // Emit socket notifications in one synchronous pass
      const io = req.app.get('io');
      if (io) {
        savedMessages.forEach((msg, index) => {
          io.to(allPlayers[index]._id.toString()).emit('receiveMessage', {
            _id: msg._id,
            senderId: 'system',
            receiverId: allPlayers[index]._id.toString(),
            message: msg.message,
            messageType: 'match_scheduled',
            tournamentId: matchData.tournament,
            matchId: scheduledMatch._id,
            timestamp: msg.timestamp
          });
        });
      }

      // Fire-and-forget FCM push notifications (never delay the HTTP response)
      const allPlayerIds = allPlayers.map(p => p._id.toString());
      notificationService.sendToMultiplePlayers(
        allPlayerIds,
        '📅 Match Scheduled',
        `${matchData.matchName} in ${tournament.tournamentName} - ${matchData.tournamentPhase}`,
        { type: 'match_scheduled', matchId: scheduledMatch._id.toString(), tournamentId: matchData.tournament.toString() }
      ).catch(err => console.error('FCM match_scheduled error:', err));
    } else {
      console.log('   ⚠️  No players found for notification');
    }

    // Include teams in response
    const matchResponse = {
      ...scheduledMatch.toObject(),
      teams: teamDetails // Add teams dynamically fetched from groups
    };

    res.status(201).json(matchResponse);

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

    // Fetch match with all necessary data including groups for scheduled matches
    const match = await Match.findById(matchId)
      .select('roomCredentials results tournament tournamentPhase matchNumber participatingGroups')
      .populate('tournament', 'tournamentName logo phases status')
      .lean();

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if tournament is concluded
    if (match.tournament?.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is concluded. Matches are locked.' });
    }

    // Check if credentials already shared
    if (match.roomCredentials?.sharedAt) {
      return res.status(409).json({
        error: 'Credentials already shared',
        sharedAt: match.roomCredentials.sharedAt
      });
    }

    // Get teams either from results or from participating groups
    let teamIds = (match.results || []).map(pt => pt.team?._id || pt.team || pt);

    // Support for scheduled matches: If results is empty, resolve teams from participatingGroups
    if (teamIds.length === 0 && match.participatingGroups?.length > 0) {
      const phase = match.tournament?.phases?.find(p => p.name === match.tournamentPhase);
      if (phase) {
        const groupNames = match.participatingGroups.map(groupId => {
          const group = phase.groups?.find(g =>
            g?._id?.toString() === groupId ||
            g?.id?.toString?.() === groupId ||
            g?.name === groupId
          );
          return group?.name;
        }).filter(Boolean);

        if (groupNames.length > 0) {
          const registrations = await Registration.find({
            tournament: match.tournament?._id || match.tournament,
            phase: match.tournamentPhase,
            group: { $in: groupNames },
            status: { $in: ['approved', 'checked_in'] }
          }).select('team').lean();
          teamIds = registrations.map(reg => reg.team);
        }
      }
    }

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

    // --- NEW: Automated Phase Transition (Secondary trigger) ---
    // "No Overlap" Rule: Flip to in_progress if no other phase is currently active
    try {
      const anyOtherPhaseInProgress = match.tournament?.phases?.some(
        p => p.status === 'in_progress' && p.name !== match.tournamentPhase
      );

      if (match.tournamentPhase && !anyOtherPhaseInProgress) {
        const tournamentId = match.tournament?._id || match.tournament;
        await Tournament.updateOne(
          {
            _id: tournamentId,
            'phases.name': match.tournamentPhase,
            'phases.status': 'upcoming'
          },
          { $set: { 'phases.$.status': 'in_progress' } }
        );
        console.log(`🚀 Automated Phase Transition (Credentials): "${match.tournamentPhase}" set to in_progress`);
      }
    } catch (phaseError) {
      console.warn('⚠️ Automated phase transition failed (non-critical):', phaseError.message);
    }

    // Prepare notification data
    const tournamentName = match.tournament?.tournamentName || 'Unknown Tournament';
    const tournamentPhase = match.tournamentPhase || 'Unknown Phase';
    const matchNumber = match.matchNumber || 'Unknown';
    const tournamentLogo = match.tournament?.logo || null;

    // Import ChatMessage model
    const ChatMessage = (await import('../models/chat.model.js')).default;

    // Build a team→slot lookup from the group slotLists stored in the tournament doc
    // so we can personalise the message with each player's slot number
    const slotByTeam = {};
    const phaseMeta = match.tournament?.phases?.find(p => p.name === match.tournamentPhase);
    if (phaseMeta) {
      for (const grpMeta of (phaseMeta.groups || [])) {
        for (const entry of (grpMeta.slotList || [])) {
          if (entry.team) slotByTeam[entry.team.toString()] = entry.slot;
        }
      }
    }

    // Batch insert messages (optimized) — each player gets their slot number personalised
    const messages = eligiblePlayers.map(player => {
      const teamId = player.team?.toString();
      const slot = teamId ? slotByTeam[teamId] : undefined;
      const slotLine = slot != null ? `\n🎰 Your Slot: ${slot}` : '';

      const messageContent = `🎮 Room Credentials for Match #${matchNumber}\n\n📋 Tournament: ${tournamentName}\n🎯 Phase: ${tournamentPhase}${slotLine}\n\n🔑 Room ID: ${roomId}\n🔐 Password: ${password}\n\n⏰ Match starts soon. Good luck!`;

      return {
        senderId: 'system',
        receiverId: player._id,
        message: messageContent,
        messageType: 'system',
        tournamentId: match.tournament?._id || match.tournament,
        matchId: match._id,
        timestamp: new Date(),
        ...(tournamentLogo && { tournamentLogo })
      };
    });

    // Insert all messages at once
    const savedMessages = await ChatMessage.insertMany(messages, { ordered: false });

    // Emit socket notifications in batch
    const io = req.app.get('io');
    if (io) {
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
        io.to(player._id.toString()).emit('receiveMessage', message);
      });

      // Also emit a broadcast to the match room if you have rooms
      io.to(`match_${matchId}`).emit('credentialsShared', {
        matchId: match._id,
        roomId: roomId.trim(),
        sharedAt: new Date()
      });
    }

    // Fire-and-forget FCM push notifications for room credentials
    const eligiblePlayerIds = eligiblePlayers.map(p => p._id.toString());
    notificationService.sendToMultiplePlayers(
      eligiblePlayerIds,
      '🔑 Room Credentials Shared',
      `Match #${match.matchNumber} - Room ID: ${roomId} | Password: ${password}`,
      { type: 'room_credentials', matchId: matchId, tournamentId: (match.tournament?._id || match.tournament).toString() }
    ).catch(err => console.error('FCM room_credentials error:', err));

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

    // Fetch the updated match with all necessary populations for the frontend
    const updatedMatch = await Match.findById(matchId)
      .populate('tournament', 'tournamentName logo')
      .populate('results.team', 'teamName teamTag logo')
      .populate('results.kills.breakdown.player', 'username')
      .lean();

    res.json(updatedMatch);

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

    const match = await Match.findById(matchId).populate('tournament', 'status');
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if tournament is concluded
    if (match.tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is concluded. Results are locked.' });
    }

    // Update participating teams with results
    if (results && results.length > 0) {
      let overallMostKills = 0;
      let overallBestPlayer = null;

      for (const result of results) {
        let teamIndex = match.results.findIndex(
          team => (team.team?._id || team.team).toString() === result.teamId
        );

        // If team not in results yet, add it
        if (teamIndex === -1) {
          match.results.push({
            team: result.teamId,
            points: { placementPoints: 0, killPoints: 0, totalPoints: 0 },
            kills: { total: 0, unmatchedKills: 0, breakdown: [] },
            chickenDinner: false
          });
          teamIndex = match.results.length - 1;
        }

        const teamEntry = match.results[teamIndex];

        // Ensure nested structures exist
        if (!teamEntry.points) teamEntry.points = { placementPoints: 0, killPoints: 0, totalPoints: 0 };
        if (!teamEntry.kills) teamEntry.kills = { total: 0, unmatchedKills: 0, breakdown: [] };

        const placementPoints = getPlacementPoints(result.position);

        teamEntry.finalPosition = result.position;
        teamEntry.kills.total = result.kills || 0;
        teamEntry.kills.unmatchedKills = result.unmatchedKills || 0;
        teamEntry.points.placementPoints = placementPoints;
        teamEntry.points.killPoints = result.kills || 0;
        teamEntry.points.totalPoints = placementPoints + (result.kills || 0);

        // ── Player-level kills breakdown ──
        // Priority 1: Full OCR breakdown with isPlaying flags (from processScreenshots)
        if (result.playerBreakdown && Array.isArray(result.playerBreakdown) && result.playerBreakdown.length > 0) {
          teamEntry.kills.breakdown = result.playerBreakdown
            .filter(bd => bd.player) // Only entries with player IDs
            .map(bd => ({
              player: bd.player,
              kills: bd.kills || 0,
              isPlaying: bd.isPlaying !== undefined ? bd.isPlaying : true,
            }));
        }
        // Priority 2: Simple playerKills array (from manual entry or legacy OCR)
        else if (result.playerKills && Array.isArray(result.playerKills)) {
          // If breakdown is empty or missing players, try to get team members
          if (!teamEntry.kills.breakdown || teamEntry.kills.breakdown.length === 0 || teamEntry.kills.breakdown.some(b => !b.player)) {
            // Try to get from Registration roster first
            const registration = await Registration.findOne({
              tournament: match.tournament._id || match.tournament,
              team: result.teamId,
              status: { $in: ['approved', 'checked_in'] }
            }).select('roster').lean();

            let playersList = [];
            if (registration && registration.roster && registration.roster.length > 0) {
              playersList = registration.roster.map(r => r.player);
            } else {
              const teamWithPlayers = await Team.findById(result.teamId).select('players').lean();
              if (teamWithPlayers && teamWithPlayers.players) {
                playersList = teamWithPlayers.players;
              }
            }

            if (playersList.length > 0) {
              teamEntry.kills.breakdown = playersList.map((playerId, index) => ({
                player: playerId,
                kills: result.playerKills[index] || 0,
                isPlaying: (result.playerKills[index] || 0) > 0 ? true : (result.isPlayingFlags?.[index] ?? true),
              }));
            } else {
              // Fallback to null players if team members not found
              teamEntry.kills.breakdown = result.playerKills.map((kills, index) => ({
                player: (teamEntry.kills.breakdown && teamEntry.kills.breakdown[index]) ? teamEntry.kills.breakdown[index].player : null,
                kills: kills || 0,
                isPlaying: true,
              }));
            }
          } else {
            // Update existing breakdown — preserve isPlaying flags
            result.playerKills.forEach((kills, index) => {
              if (teamEntry.kills.breakdown[index]) {
                teamEntry.kills.breakdown[index].kills = kills || 0;
                // If isPlayingFlags provided, use them; otherwise preserve existing
                if (result.isPlayingFlags && result.isPlayingFlags[index] !== undefined) {
                  teamEntry.kills.breakdown[index].isPlaying = result.isPlayingFlags[index];
                }
              }
            });
          }
        }

        // Track overall most kills for matchStats (only from playing players)
        if (teamEntry.kills.breakdown) {
          teamEntry.kills.breakdown.forEach(b => {
            if (b.player && b.kills > overallMostKills && b.isPlaying !== false) {
              overallMostKills = b.kills;
              overallBestPlayer = b.player;
            }
          });
        }

        teamEntry.chickenDinner = result.position === 1;
      }

      // Update matchStats
      if (overallBestPlayer) {
        match.matchStats.mostKillsPlayer = {
          player: overallBestPlayer,
          kills: overallMostKills
        };
      }
    }

    // Keep completed matches completed when editing results.
    // Only move scheduled matches forward to in_progress.
    if (match.status !== 'completed') {
      match.status = 'in_progress';
    }

    await match.save();
    await match.populate('results.team', 'teamName teamTag logo');
    await match.populate('results.kills.breakdown.player', 'username gameIds inGameName profilePicture');
    await match.populate('matchStats.mostKillsPlayer.player', 'username gameIds inGameName profilePicture');

    // Fire-and-forget: keep player+team stats counters in sync (never blocks response)
    const teamIdsForStats = match.results.map(r => r.team._id || r.team).filter(Boolean);
    if (teamIdsForStats.length > 0) {
      // 1. Recalculate basic team/player stats
      recalculateStatsForTeams(teamIdsForStats).catch(err =>
        console.warn('⚠️ Stats recalculation failed (non-critical):', err.message)
      );

      // 2. Recalculate Phase Standings (The Points Table)
      const PhaseStanding = mongoose.model('PhaseStanding');
      PhaseStanding.getOrCreate(match.tournament, match.tournamentPhase)
        .then(ps => ps.recalculate())
        .catch(err => console.warn('⚠️ Phase Standing recalculation failed:', err.message));
    }

    console.log('✅ Updated match results and stats:', match._id);
    res.json(match);
  } catch (error) {
    console.error('Error updating match results:', error);
    res.status(500).json({ error: 'Failed to update match results' });
  }
});

// ============================================================================
// STATS RECALCULATION HELPER (fire-and-forget after match result saves)
// ============================================================================

/**
 * Recalculates and persists player + team statistics counters based on
 * completed Match documents. Called asynchronously — never blocks a response.
 * @param {ObjectId[]} teamIds
 */
export const recalculateStatsForTeams = async (teamIds) => {
  if (!teamIds || teamIds.length === 0) return;

  const teamOids = teamIds.map(id => new mongoose.Types.ObjectId(id));

  // --- 1. Total Team Stats (Career) ---
  const teamStats = await Match.aggregate([
    {
      $match: {
        'results.team': { $in: teamOids },
        status: { $in: ['completed', 'in_progress'] },
      },
    },
    { $unwind: '$results' },
    {
      $match: { 'results.team': { $in: teamOids } },
    },
    {
      $group: {
        _id: '$results.team',
        matchesPlayed: { $sum: 1 },
        matchesWon: {
          $sum: { $cond: [{ $eq: ['$results.finalPosition', 1] }, 1, 0] },
        },
        totalKills: { $sum: { $ifNull: ['$results.kills.total', 0] } },
        positionSum: { $sum: { $ifNull: ['$results.finalPosition', 0] } },
        positionCount: {
          $sum: { $cond: [{ $gt: ['$results.finalPosition', 0] }, 1, 0] },
        },
      },
    },
  ]);

  const teamBulkOps = teamStats.map(stat => {
    const winRate = stat.matchesPlayed > 0 ? Math.round((stat.matchesWon / stat.matchesPlayed) * 100) : 0;
    const avgPlacement = stat.positionCount > 0 ? Math.round((stat.positionSum / stat.positionCount) * 10) / 10 : 0;
    return {
      updateOne: {
        filter: { _id: stat._id },
        update: {
          $set: {
            'statistics.matchesPlayed': stat.matchesPlayed,
            'statistics.matchesWon': stat.matchesWon,
            'statistics.chickenDinners': stat.matchesWon,
            'statistics.totalKills': stat.totalKills,
            'statistics.winRate': winRate,
            'statistics.averagePlacement': avgPlacement,
          },
        },
      },
    };
  });

  if (teamBulkOps.length > 0) await Team.bulkWrite(teamBulkOps, { ordered: false });

  // --- 2. Registration Sync (For Profile Tournament History) ---
  const registrationStats = await Match.aggregate([
    {
      $match: {
        'results.team': { $in: teamOids },
        status: { $in: ['completed', 'in_progress'] },
      },
    },
    { $unwind: '$results' },
    {
      $match: { 'results.team': { $in: teamOids } },
    },
    {
      $group: {
        _id: {
          team: '$results.team',
          tournament: '$tournament'
        },
        totalPoints: { $sum: { $ifNull: ['$results.points.totalPoints', 0] } },
        totalKills: { $sum: { $ifNull: ['$results.kills.total', 0] } },
        matchesPlayed: { $sum: 1 }
      }
    }
  ]);

  const regBulkOps = registrationStats.map(stat => ({
    updateOne: {
      filter: {
        team: stat._id.team,
        tournament: stat._id.tournament,
        status: { $in: ['approved', 'checked_in', 'completed'] }
      },
      update: {
        $set: {
          totalTournamentPoints: stat.totalPoints,
          totalTournamentKills: stat.totalKills,
          matchesPlayed: stat.matchesPlayed
        }
      }
    }
  }));

  if (regBulkOps.length > 0) await Registration.bulkWrite(regBulkOps, { ordered: false });

  // --- 3. Player Stats (Career) ---
  const teams = await Team.find({ _id: { $in: teamIds } }).select('players').lean();
  const allPlayerIds = teams.flatMap(t => t.players || []);
  if (allPlayerIds.length === 0) return;

  const playerStats = await Match.aggregate([
    {
      $match: {
        'results.team': { $in: teamOids },
        status: { $in: ['completed', 'in_progress'] },
      },
    },
    { $unwind: '$results' },
    {
      $match: { 'results.team': { $in: teamOids } },
    },
    { $unwind: { path: '$results.kills.breakdown', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$results.kills.breakdown.player',
        totalKills: { $sum: { $ifNull: ['$results.kills.breakdown.kills', 0] } },
        matchesPlayed: { $sum: 1 },
        matchesWon: {
          $sum: { $cond: [{ $eq: ['$results.finalPosition', 1] }, 1, 0] },
        },
      },
    },
    { $match: { _id: { $ne: null } } },
  ]);

  const playerBulkOps = playerStats.map(stat => ({
    updateOne: {
      filter: { _id: stat._id },
      update: {
        $set: {
          matchesPlayed: stat.matchesPlayed,
          'statistics.totalKills': stat.totalKills,
          'statistics.matchesWon': stat.matchesWon,
          'statistics.matchesPlayed': stat.matchesPlayed,
          'statistics.winRate': stat.matchesPlayed > 0 ? Math.round((stat.matchesWon / stat.matchesPlayed) * 100) : 0,
        },
      },
    },
  }));

  if (playerBulkOps.length > 0) await Player.bulkWrite(playerBulkOps, { ordered: false });

  // --- 4. Tournament Participation (Career) ---
  // A tournament is "played" if the registration reached certain status
  const playerTourneyStats = await Registration.aggregate([
    {
      $match: {
        'roster.player': { $in: allPlayerIds },
        status: { $in: ['approved', 'checked_in', 'disqualified', 'withdrawn', 'completed'] }
      }
    },
    { $unwind: '$roster' },
    {
      $match: { 'roster.player': { $in: allPlayerIds } }
    },
    {
      $group: {
        _id: '$roster.player',
        tournamentsPlayed: { $sum: 1 }
      }
    }
  ]);

  const tourneyBulkOps = playerTourneyStats.map(stat => ({
    updateOne: {
      filter: { _id: stat._id },
      update: {
        $set: {
          tournamentsPlayed: stat.tournamentsPlayed,
          'statistics.tournamentsPlayed': stat.tournamentsPlayed
        }
      }
    }
  }));

  if (tourneyBulkOps.length > 0) await Player.bulkWrite(tourneyBulkOps, { ordered: false });
};

// Helper: after deleting a match, unlock groups that have zero remaining scheduled matches
const unlockOrphanedGroups = async (tournamentId, phaseName, deletedGroupIds) => {
  if (!deletedGroupIds || deletedGroupIds.length === 0) return;

  // Fetch the tournament to read the current groups + their names
  const tourDoc = await Tournament.findById(tournamentId)
    .select('phases')
    .lean();
  if (!tourDoc) return;

  const phaseDoc = tourDoc.phases?.find(p => p.name === phaseName);
  if (!phaseDoc) return;

  // Resolve the group NAMES from the stored group IDs/names used by the match
  const groupNamesToCheck = deletedGroupIds.map(groupId => {
    const grp = (phaseDoc.groups || []).find(g =>
      g._id?.toString() === groupId ||
      g.id?.toString() === groupId ||
      g.name === groupId
    );
    return grp?.name;
  }).filter(Boolean);

  if (groupNamesToCheck.length === 0) return;

  // For each group name, count how many remaining scheduled matches still reference it
  // A group can only be unlocked when no remaining scheduled match uses it
  const remainingMatches = await Match.find({
    tournament: tournamentId,
    tournamentPhase: phaseName,
    status: 'scheduled',
    participatingGroups: { $in: deletedGroupIds } // still store IDs in match
  }).select('participatingGroups').lean();

  // Build a set of group identifiers (id or name) still used by remaining matches
  const stillUsed = new Set(remainingMatches.flatMap(m => m.participatingGroups || []));

  // Determine which group names are truly orphaned (no remaining matches)
  const groupsToUnlock = groupNamesToCheck.filter(gName => {
    // Check both ID and name forms
    const grp = (phaseDoc.groups || []).find(g => g.name === gName);
    const gId = grp?._id?.toString();
    return !stillUsed.has(gId) && !stillUsed.has(gName);
  });

  if (groupsToUnlock.length === 0) return;

  // Unlock only the truly orphaned groups via arrayFilters
  await Tournament.updateOne(
    { _id: tournamentId, 'phases.name': phaseName },
    { $set: { 'phases.$[phase].groups.$[grp].isLocked': false } },
    {
      arrayFilters: [
        { 'phase.name': phaseName },
        { 'grp.name': { $in: groupsToUnlock } }
      ]
    }
  );

  console.log(`🔓 Unlocked groups: ${groupsToUnlock.join(', ')} in phase "${phaseName}"`);
};

// Delete a match
router.delete('/:matchId', verifyOrgToken, verifyMatchOwnership, async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId).lean();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Remove reference from tournament phases
    await Tournament.updateOne(
      { _id: match.tournament },
      { $pull: { 'phases.$[].matches': matchId } }
    );

    // Delete the match first
    await Match.findByIdAndDelete(matchId);

    // Safe-unlock: only unlock groups that have NO other scheduled matches referencing them
    if (match.participatingGroups?.length > 0 && match.tournamentPhase) {
      await unlockOrphanedGroups(match.tournament, match.tournamentPhase, match.participatingGroups);
    }

    // 3. Trigger Phase Standing recalculation
    const PhaseStanding = mongoose.model('PhaseStanding');
    PhaseStanding.getOrCreate(match.tournament, match.tournamentPhase)
      .then(ps => ps.recalculate())
      .catch(err => console.warn('⚠️ Phase Standing recalculation failed after delete:', err.message));

    console.log(`✅ Deleted match: ${matchId}`);
    res.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

// Alias for scheduled match deletion
router.delete('/scheduled/:matchId', verifyOrgToken, verifyMatchOwnership, async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId).lean();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Remove reference from tournament phases
    await Tournament.updateOne(
      { _id: match.tournament },
      { $pull: { 'phases.$[].matches': matchId } }
    );

    // Delete the match first
    await Match.findByIdAndDelete(matchId);

    // Safe-unlock: only unlock groups that have NO other scheduled matches referencing them
    if (match.participatingGroups?.length > 0 && match.tournamentPhase) {
      await unlockOrphanedGroups(match.tournament, match.tournamentPhase, match.participatingGroups);
    }

    // 3. Trigger Phase Standing recalculation
    const PhaseStanding = mongoose.model('PhaseStanding');
    PhaseStanding.getOrCreate(match.tournament, match.tournamentPhase)
      .then(ps => ps.recalculate())
      .catch(err => console.warn('⚠️ Phase Standing recalculation failed after delete:', err.message));

    console.log(`✅ Deleted scheduled match: ${matchId}`);
    res.json({ success: true, message: 'Scheduled match deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled match:', error);
    res.status(500).json({ error: 'Failed to delete scheduled match' });
  }
});


// Get a single match by ID (public — no auth required)
// Optimized with targeted population and lean()
router.get('/:matchId/live', async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ error: 'Invalid match ID format' });
    }

    const match = await Match.findById(matchId)
      .populate('results.team', 'teamName teamTag logo')
      .populate('results.kills.breakdown.player', 'username gameIds inGameName profilePicture')
      .populate('tournament', 'tournamentName shortName logo')
      .lean();

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const live = await LiveMatchState.findOne({ match: matchId })
      .populate('teams.team', 'teamName teamTag logo')
      .populate('teams.players.player', 'username gameIds inGameName profilePicture')
      .lean();

    const gameConfig = getGameConfig(match.gameTitle || 'BGMI');
    res.json({ match, live, scoring: gameConfig?.scoring || null });
  } catch (error) {
    console.error('Error fetching live match state:', error);
    res.status(500).json({ error: 'Failed to fetch live match info' });
  }
});

router.get('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ error: 'Invalid match ID format' });
    }

    const match = await Match.findById(matchId)
      .populate('results.team', 'teamName teamTag logo')
      .populate('results.kills.breakdown.player', 'username gameIds inGameName profilePicture')
      .populate('matchStats.mostKillsPlayer.player', 'username gameIds inGameName profilePicture')
      .populate('tournament', 'tournamentName shortName logo')
      .lean();

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(match);
  } catch (error) {
    console.error('Error fetching match by ID:', error);
    res.status(500).json({ error: 'Failed to fetch match info' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OCR: Process up to 12 match screenshots → return structured results for review
// POST /api/matches/:matchId/upload-result
//
// Auth:  verifyOrgToken + verifyMatchOwnership  (org must own the tournament)
// Body:  multipart/form-data  |  field: screenshots (images, max 5 MB each, up to 12)
//
// Flow:
//  1. Validate files
//  2. Fetch match + tournament to get slot list
//  3. Build slotList from groups[].slotList[] (populated with team names & rosters)
//  4. Run OCR via processScreenshots()
//  5. Return editable result rows — nothing is saved to DB
//
// The caller (frontend) reviews/edits results, then POSTs to PUT /:matchId/results
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:matchId/upload-result',
  verifyOrgToken,
  verifyMatchOwnership,
  upload.array('screenshots', 12),
  async (req, res) => {
    try {
      // ── 1. Validate uploaded files ────────────────────────────────────────
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided. Send up to 12 images in the \'screenshots\' field.' });
      }

      const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      for (const file of req.files) {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return res.status(400).json({ error: 'Unsupported file type. Upload JPEG, PNG, or WebP only.' });
        }
      }

      const { matchId } = req.params;

      // ── 2. Fetch match + tournament (only what we need) ──────────────────
      const match = await Match.findById(matchId)
        .select('tournament tournamentPhase participatingGroups results')
        .lean();
      if (!match) return res.status(404).json({ error: 'Match not found' });

      const tournament = await Tournament.findById(match.tournament)
        .select('phases status')
        .lean();
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.status === 'completed') {
        return res.status(400).json({ error: 'Tournament is concluded and locked.' });
      }

      // ── 3. Resolve slot list from tournament phases.groups.slotList ──────
      const phase = tournament.phases?.find(p => p.name === match.tournamentPhase);
      if (!phase) {
        return res.status(400).json({ error: `Phase "${match.tournamentPhase}" not found in tournament.` });
      }

      // Gather all groups that participated in this match
      const matchGroupIds = new Set((match.participatingGroups || []).map(g => g.toString()));

      // Collect slot entries from all relevant groups, then populate team names
      const rawSlotEntries = []; // { slot, teamId }
      for (const group of (phase.groups || [])) {
        const gId = group._id?.toString();
        const matchesThisGroup = matchGroupIds.has(gId) || matchGroupIds.has(group.name);
        if (!matchesThisGroup) continue;
        for (const entry of (group.slotList || [])) {
          if (entry.team) {
            rawSlotEntries.push({ slot: entry.slot, teamId: entry.team.toString() });
          }
        }
      }

      // Fallback: if participatingGroups is empty, gather all group slot entries for the phase
      if (rawSlotEntries.length === 0) {
        for (const group of (phase.groups || [])) {
          for (const entry of (group.slotList || [])) {
            if (entry.team) rawSlotEntries.push({ slot: entry.slot, teamId: entry.team.toString() });
          }
        }
      }

      if (rawSlotEntries.length === 0) {
        return res.status(400).json({
          error: 'No slot list found for this match. Assign groups and generate the slot list before using OCR.',
        });
      }

      // Batch-fetch team names AND rosters for the tournament
      const uniqueTeamIds = [...new Set(rawSlotEntries.map(e => e.teamId))];

      const [teams, registrations] = await Promise.all([
        Team.find({ _id: { $in: uniqueTeamIds } }).select('teamName').lean(),
        Registration.find({
          tournament: match.tournament,
          team: { $in: uniqueTeamIds },
          status: { $in: ['approved', 'checked_in'] }
        }).populate('roster.player', 'username gameIds').select('team roster').lean()
      ]);

      const teamNameById = Object.fromEntries(teams.map(t => [t._id.toString(), t.teamName]));
      const rosterByTeamId = Object.fromEntries(registrations.map(r => [r.team.toString(), r.roster || []]));

      const slotList = rawSlotEntries
        .filter(e => teamNameById[e.teamId]) // skip orphaned refs
        .map(e => ({
          slot: e.slot,
          teamId: e.teamId,
          teamName: teamNameById[e.teamId],
          roster: rosterByTeamId[e.teamId] || []
        }))
        .sort((a, b) => a.slot - b.slot);

      if (slotList.length === 0) {
        return res.status(400).json({ error: 'Could not resolve team names for slot list. Ensure teams are properly assigned.' });
      }

      // ── 4. Run OCR on all images ────────────────────────────────────────────
      const imageBuffers = req.files.map(file => file.buffer);
      // We will create `processScreenshots` in the service to handle multiple buffers
      const ocrResults = await processScreenshots(imageBuffers, slotList);

      if (ocrResults.length === 0) {
        return res.status(422).json({
          error: 'OCR could not detect any recognisable team data in the provided images.',
          hint: 'Ensure the screenshots are clear BGMI match result screens.',
        });
      }

      // ── 5. Return for frontend review ────────────────────────────────────
      res.json({
        ocrResults,
        matchId,
        slotListUsed: slotList.length,
        detectedTeams: ocrResults.length,
        imagesProcessed: req.files.length
      });
    } catch (err) {
      console.error('❌ OCR upload-result error:', err);

      // Friendly error for missing AWS credentials
      if (err.message?.includes('AWS credentials')) {
        return res.status(503).json({ error: 'OCR service is not configured. Contact the administrator.' });
      }

      // AWS Rekognition errors
      if (err.name === 'InvalidImageFormatException') {
        return res.status(400).json({ error: 'Invalid image format. Use JPEG, PNG, or WebP.' });
      }
      if (err.name === 'ImageTooLargeException') {
        return res.status(400).json({ error: 'An image is too large for OCR. Try smaller screenshots (max 5 MB each).' });
      }
      if (err.name === 'ProvisionedThroughputExceededException' || err.name === 'ThrottlingException') {
        return res.status(429).json({ error: 'OCR service is temporarily busy. Please try again in a few seconds.' });
      }

      res.status(500).json({ error: 'OCR processing failed. Please try again or enter results manually.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Valorant 5v5 Results Entry
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/:matchId/valorant-results', verifyOrgToken, verifyMatchOwnership, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { vsResults } = req.body;

    if (!vsResults || !vsResults.teamA || !vsResults.teamB) {
      return res.status(400).json({ error: 'vsResults with teamA and teamB are required' });
    }

    const match = await Match.findById(matchId).populate('tournament', 'status gameTitle');
    if (!match) return res.status(404).json({ error: 'Match not found' });

    if (match.tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is concluded. Results are locked.' });
    }

    if (match.gameTitle !== 'VALORANT') {
      return res.status(400).json({ error: 'This endpoint is for Valorant matches only. Use the standard results endpoint for BR games.' });
    }

    // Validate teams exist
    const [teamA, teamB] = await Promise.all([
      Team.findById(vsResults.teamA).select('teamName').lean(),
      Team.findById(vsResults.teamB).select('teamName').lean(),
    ]);
    if (!teamA || !teamB) {
      return res.status(400).json({ error: 'One or both teams not found' });
    }

    // Determine winner
    const scoreA = vsResults.scoreA || 0;
    const scoreB = vsResults.scoreB || 0;
    const winner = scoreA > scoreB ? vsResults.teamA : scoreB > scoreA ? vsResults.teamB : null;

    // Build update
    const updateData = {
      'vsResults.teamA': vsResults.teamA,
      'vsResults.teamB': vsResults.teamB,
      'vsResults.scoreA': scoreA,
      'vsResults.scoreB': scoreB,
      'vsResults.winner': winner,
      'vsResults.totalRounds': scoreA + scoreB,
      'vsResults.isOvertime': (scoreA + scoreB) > 24,
      status: 'completed',
      'metadata.manuallyEntered': true,
    };

    // Map results (for Bo3/Bo5)
    if (vsResults.mapResults && Array.isArray(vsResults.mapResults)) {
      updateData['vsResults.mapResults'] = vsResults.mapResults.map(mr => ({
        map: mr.map,
        scoreA: mr.scoreA || 0,
        scoreB: mr.scoreB || 0,
        winner: (mr.scoreA || 0) > (mr.scoreB || 0) ? vsResults.teamA : vsResults.teamB,
        halfScores: mr.halfScores || {},
      }));
    }

    // Player stats
    if (vsResults.playerStats && Array.isArray(vsResults.playerStats)) {
      updateData['vsResults.playerStats'] = vsResults.playerStats.map(ps => ({
        player: ps.player,
        team: ps.team,
        kills: ps.kills || 0,
        deaths: ps.deaths || 0,
        assists: ps.assists || 0,
        agent: ps.agent || '',
        acs: ps.acs || 0,
        adr: ps.adr || 0,
        firstKills: ps.firstKills || 0,
        firstDeaths: ps.firstDeaths || 0,
        clutches: ps.clutches || 0,
        plants: ps.plants || 0,
        defuses: ps.defuses || 0,
        multiKills: ps.multiKills || 0,
      }));
    }

    await Match.findByIdAndUpdate(matchId, { $set: updateData });

    // Update player stats
    if (vsResults.playerStats?.length > 0) {
      const playerOps = [];
      for (const ps of vsResults.playerStats) {
        if (!ps.player) continue;
        const isWinner = (ps.team?.toString() || ps.team) === winner?.toString();
        playerOps.push({
          updateOne: {
            filter: { _id: ps.player },
            update: {
              $inc: {
                'valorantStats.matchesPlayed': 1,
                'valorantStats.matchesWon': isWinner ? 1 : 0,
                'valorantStats.totalKills': ps.kills || 0,
                'valorantStats.totalDeaths': ps.deaths || 0,
                'valorantStats.totalAssists': ps.assists || 0,
                'valorantStats.totalFirstKills': ps.firstKills || 0,
                'valorantStats.totalClutches': ps.clutches || 0,
              },
            },
          },
        });
      }
      if (playerOps.length > 0) await Player.bulkWrite(playerOps);
    }

    // Update registration stats
    for (const teamId of [vsResults.teamA, vsResults.teamB]) {
      const isWinner = teamId?.toString() === winner?.toString();
      const teamPlayerStats = (vsResults.playerStats || []).filter(
        ps => (ps.team?.toString() || ps.team) === teamId?.toString()
      );
      const teamKills = teamPlayerStats.reduce((sum, ps) => sum + (ps.kills || 0), 0);
      const teamDeaths = teamPlayerStats.reduce((sum, ps) => sum + (ps.deaths || 0), 0);
      const teamAssists = teamPlayerStats.reduce((sum, ps) => sum + (ps.assists || 0), 0);

      await Registration.updateOne(
        {
          tournament: match.tournament._id || match.tournament,
          team: teamId,
          phase: match.tournamentPhase,
        },
        {
          $inc: {
            matchesPlayed: 1,
            totalKills: teamKills,
            totalDeaths: teamDeaths,
            totalAssists: teamAssists,
            totalRoundsWon: teamId?.toString() === vsResults.teamA?.toString() ? scoreA : scoreB,
            totalChickenDinners: isWinner ? 1 : 0,  // reuse as totalWins for Valorant
          },
        }
      );
    }

    // Fetch updated match for response
    const updatedMatch = await Match.findById(matchId)
      .populate('tournament', 'tournamentName gameTitle')
      .populate('vsResults.teamA', 'teamName teamTag logo')
      .populate('vsResults.teamB', 'teamName teamTag logo')
      .populate('vsResults.winner', 'teamName teamTag logo')
      .populate('vsResults.playerStats.player', 'username gameIds inGameName profilePicture')
      .lean();

    console.log(`✅ Valorant match ${matchId} results saved: ${teamA.teamName} ${scoreA}-${scoreB} ${teamB.teamName}`);

    res.json(updatedMatch);
  } catch (error) {
    console.error('Error saving Valorant results:', error);
    res.status(500).json({ error: 'Failed to save Valorant results', details: error.message });
  }
});

export default router;
