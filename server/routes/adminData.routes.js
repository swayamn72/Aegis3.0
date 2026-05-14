import express from 'express';
import mongoose from 'mongoose';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Match from '../models/match.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import { verifyAdminToken } from '../middleware/adminAuth.js';
import { claimShadowProfile } from '../services/shadowClaim.service.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const sanitize = (s) => (typeof s === 'string' ? s.trim().replace(/[<>]/g, '') : '');

const actionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

// ===================== SHADOW PLAYER CRUD =====================

// Create shadow player
router.post('/players/shadow', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { realName, inGameName, characterId, inGameRole, profilePicture, teamId } = req.body;
    if (!inGameName || !characterId) {
      return res.status(400).json({ error: 'inGameName and characterId are required' });
    }
    const existing = await Player.findOne({ 'gameIds.characterId': sanitize(characterId), isShadowProfile: true, claimedBy: null });
    if (existing) return res.status(409).json({ error: 'Shadow player with this characterId already exists' });

    const player = await Player.create({
      isShadowProfile: true,
      shadowCreatedBy: req.admin.adminId,
      realName: sanitize(realName || ''),
      gameIds: [{ inGameName: sanitize(inGameName), characterId: sanitize(characterId), isPrimary: true }],
      inGameRole: inGameRole || [],
      profilePicture: profilePicture || '',
      team: teamId && isValidId(teamId) ? teamId : null,
      verified: false,
      isEmailVerified: false,
      authProvider: [],
    });

    // Add to team roster if teamId provided
    if (teamId && isValidId(teamId)) {
      await Team.findByIdAndUpdate(teamId, { $addToSet: { players: player._id } });
    }

    res.status(201).json({ message: 'Shadow player created', player });
  } catch (error) {
    console.error('Create shadow player error:', error);
    res.status(500).json({ error: 'Failed to create shadow player' });
  }
});

// Bulk create shadow players
router.post('/players/shadow/bulk', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { players } = req.body;
    if (!Array.isArray(players) || players.length === 0) return res.status(400).json({ error: 'players array required' });
    if (players.length > 50) return res.status(400).json({ error: 'Max 50 players per bulk request' });

    const created = [];
    const errors = [];
    for (const p of players) {
      try {
        if (!p.inGameName || !p.characterId) { errors.push({ ...p, error: 'Missing inGameName or characterId' }); continue; }
        const player = await Player.create({
          isShadowProfile: true, shadowCreatedBy: req.admin.adminId,
          realName: sanitize(p.realName || ''), profilePicture: p.profilePicture || '',
          gameIds: [{ inGameName: sanitize(p.inGameName), characterId: sanitize(p.characterId), isPrimary: true }],
          inGameRole: p.inGameRole || [], authProvider: [],
          team: p.teamId && isValidId(p.teamId) ? p.teamId : null,
        });
        if (p.teamId && isValidId(p.teamId)) await Team.findByIdAndUpdate(p.teamId, { $addToSet: { players: player._id } });
        created.push(player);
      } catch (e) { errors.push({ ...p, error: e.message }); }
    }
    res.status(201).json({ created: created.length, errors: errors.length, createdPlayers: created, errors });
  } catch (error) {
    console.error('Bulk shadow error:', error);
    res.status(500).json({ error: 'Failed to bulk create' });
  }
});

// List shadow players
router.get('/players/shadow', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, claimed } = req.query;
    const skip = (Math.max(1, +page) - 1) * Math.min(100, Math.max(1, +limit));
    const query = { isShadowProfile: true };
    if (claimed === 'true') query.claimedBy = { $ne: null };
    else if (claimed === 'false') query.claimedBy = null;
    if (search) {
      const s = sanitize(search);
      query.$or = [
        { realName: { $regex: s, $options: 'i' } },
        { 'gameIds.inGameName': { $regex: s, $options: 'i' } },
        { 'gameIds.characterId': { $regex: s, $options: 'i' } },
      ];
    }
    const [players, total] = await Promise.all([
      Player.find(query).sort({ createdAt: -1 }).skip(skip).limit(+limit).populate('team', 'teamName teamTag logo').populate('claimedBy', 'username email').lean(),
      Player.countDocuments(query),
    ]);
    res.json({ players, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) } });
  } catch (error) {
    console.error('List shadow error:', error);
    res.status(500).json({ error: 'Failed to list shadow players' });
  }
});

// Update shadow player
router.put('/players/shadow/:id', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid ID' });
    const player = await Player.findById(id);
    if (!player || !player.isShadowProfile) return res.status(404).json({ error: 'Shadow player not found' });
    if (player.claimedBy) return res.status(400).json({ error: 'Cannot edit a claimed profile' });

    const { realName, inGameName, characterId, inGameRole, profilePicture, teamId } = req.body;
    if (realName !== undefined) player.realName = sanitize(realName);
    if (inGameRole !== undefined) player.inGameRole = inGameRole;
    if (profilePicture !== undefined) player.profilePicture = profilePicture;
    if (inGameName && characterId && player.gameIds.length > 0) {
      player.gameIds[0].inGameName = sanitize(inGameName);
      player.gameIds[0].characterId = sanitize(characterId);
    }
    if (teamId !== undefined) {
      if (player.team) await Team.findByIdAndUpdate(player.team, { $pull: { players: player._id } });
      player.team = teamId && isValidId(teamId) ? teamId : null;
      if (player.team) await Team.findByIdAndUpdate(player.team, { $addToSet: { players: player._id } });
    }
    await player.save();
    res.json({ message: 'Shadow player updated', player });
  } catch (error) {
    console.error('Update shadow error:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// Claim shadow profile into real player
router.post('/players/shadow/:id/claim', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { realPlayerId } = req.body;
    if (!isValidId(id) || !isValidId(realPlayerId)) return res.status(400).json({ error: 'Invalid IDs' });
    const result = await claimShadowProfile(id, realPlayerId, req.admin.adminId);
    res.json(result);
  } catch (error) {
    console.error('Claim error:', error);
    res.status(400).json({ error: error.message || 'Claim failed' });
  }
});

// ===================== ADMIN TOURNAMENT CRUD =====================

// Create tournament
router.post('/tournaments/create', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { tournamentName, shortName, gameTitle, tier, region, format, startDate, endDate,
      description, prizePool, phases, slots, gameSettings, media, streamLinks, tags,
      registrationStartDate, registrationEndDate, isOpenForAll, formatDetails, sponsors } = req.body;

    if (!tournamentName || !startDate || !endDate || !format) {
      return res.status(400).json({ error: 'tournamentName, startDate, endDate, and format are required' });
    }

    const tournament = await Tournament.create({
      tournamentName: sanitize(tournamentName), shortName: sanitize(shortName || ''),
      gameTitle: gameTitle || 'BGMI', tier: tier || 'Community', region: region || 'India',
      format, formatDetails: formatDetails || '', startDate, endDate,
      description: sanitize(description || ''), prizePool: prizePool || { total: 0, currency: 'INR' },
      phases: (phases || []).map(p => ({
        name: sanitize(p.name), type: p.type || 'qualifiers', startDate: p.startDate, endDate: p.endDate,
        status: 'upcoming', details: sanitize(p.details || ''), groups: (p.groups || []).map(g => ({ name: sanitize(g.name), teams: g.teams || [] })),
        qualificationRules: p.qualificationRules || [],
      })),
      slots: { total: slots?.total || 16, invited: slots?.invited || 0, openRegistrations: slots?.openRegistrations || 0 },
      gameSettings: gameSettings || {}, media: media || {}, streamLinks: streamLinks || [],
      tags: tags || [], sponsors: sponsors || [],
      registrationStartDate, registrationEndDate, isOpenForAll: isOpenForAll || false,
      _approvalStatus: 'approved', _approvedBy: req.admin.adminId, _approvedAt: new Date(),
      visibility: 'public', status: 'announced',
    });

    res.status(201).json({ message: 'Tournament created', tournament });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: error.message || 'Failed to create tournament' });
  }
});

// Edit tournament
router.put('/tournaments/:id/edit', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid ID' });
    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const allowedFields = ['tournamentName', 'shortName', 'gameTitle', 'tier', 'region', 'format', 'formatDetails',
      'startDate', 'endDate', 'description', 'prizePool', 'phases', 'slots', 'gameSettings', 'media',
      'streamLinks', 'tags', 'sponsors', 'registrationStartDate', 'registrationEndDate', 'isOpenForAll', 'status', 'importanceScore'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) tournament[field] = req.body[field];
    }
    await tournament.save();
    res.json({ message: 'Tournament updated', tournament });
  } catch (error) {
    console.error('Edit tournament error:', error);
    res.status(500).json({ error: error.message || 'Failed to edit tournament' });
  }
});

// ===================== ADMIN TEAM CRUD =====================

router.post('/teams/create', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { teamName, teamTag, logo, primaryGame, region, playerIds, captainId } = req.body;
    if (!teamName || !captainId) return res.status(400).json({ error: 'teamName and captainId required' });
    if (!isValidId(captainId)) return res.status(400).json({ error: 'Invalid captainId' });

    // Generate a unique 6-char team ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let teamId;
    let attempts = 0;
    do {
      teamId = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      attempts++;
    } while (await Team.findOne({ teamId }) && attempts < 10);

    const players = (playerIds || []).filter(isValidId);
    if (!players.includes(captainId)) players.push(captainId);

    const team = await Team.create({
      teamId, teamName: sanitize(teamName), teamTag: sanitize(teamTag || teamName.slice(0, 4).toUpperCase()),
      logo: logo || '', primaryGame: primaryGame || 'BGMI', region: region || 'India',
      captain: captainId, players, status: 'active',
    });

    await Player.updateMany({ _id: { $in: players } }, { $set: { team: team._id } });
    res.status(201).json({ message: 'Team created', team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: error.message || 'Failed to create team' });
  }
});

// ===================== MATCH MANAGEMENT =====================

// Create match
router.post('/tournaments/:tid/matches', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { tid } = req.params;
    if (!isValidId(tid)) return res.status(400).json({ error: 'Invalid tournament ID' });
    const tournament = await Tournament.findById(tid);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const { matchNumber, tournamentPhase, scheduledStartTime, map, participatingGroups, teamIds } = req.body;
    if (!matchNumber || !tournamentPhase || !scheduledStartTime || !map) {
      return res.status(400).json({ error: 'matchNumber, tournamentPhase, scheduledStartTime, map required' });
    }

    // Build results array from teamIds with empty kill breakdowns
    const results = [];
    if (teamIds && Array.isArray(teamIds)) {
      for (const tId of teamIds) {
        if (!isValidId(tId)) continue;
        const team = await Team.findById(tId).populate('players', '_id');
        if (!team) continue;
        results.push({
          team: team._id, finalPosition: null,
          kills: { total: 0, unmatchedKills: 0, breakdown: team.players.map(p => ({ player: p._id, kills: 0, isPlaying: true })) },
          points: { placementPoints: 0, killPoints: 0, totalPoints: 0 }, chickenDinner: false, isEliminated: false,
        });
      }
    }

    const match = await Match.create({
      matchNumber, tournament: tid, tournamentPhase: sanitize(tournamentPhase),
      scheduledStartTime, map, participatingGroups: participatingGroups || [],
      status: 'scheduled', results, matchType: 'scheduled',
    });

    // Add match to tournament phase
    const phase = tournament.phases.find(p => p.name === tournamentPhase);
    if (phase) { phase.matches.push(match._id); await tournament.save(); }

    res.status(201).json({ message: 'Match created', match });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ error: error.message || 'Failed to create match' });
  }
});

// Enter/update match results (manual)
router.put('/matches/:id/results', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const { results } = req.body;
    if (!Array.isArray(results)) return res.status(400).json({ error: 'results array required' });

    match.results = results;
    match.metadata = { ...match.metadata, manuallyEntered: true };
    await match.save();
    res.json({ message: 'Results updated', match });
  } catch (error) {
    console.error('Update results error:', error);
    res.status(500).json({ error: 'Failed to update results' });
  }
});

// Finalize match — lock results, recalculate standings + ratings
router.post('/matches/:id/finalize', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status === 'completed') return res.status(400).json({ error: 'Match already finalized' });

    // Auto-calculate points from positions
    const PP_TABLE = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1 };
    for (const r of match.results) {
      if (r.finalPosition) {
        r.points.placementPoints = PP_TABLE[r.finalPosition] || 0;
        r.points.killPoints = r.kills.total;
        r.points.totalPoints = r.points.placementPoints + r.points.killPoints;
        r.chickenDinner = r.finalPosition === 1;
      }
    }

    match.status = 'completed';
    match.liveState.isLiveScoring = false;
    await match.save();

    // Recalculate phase standings
    try {
      const ps = await PhaseStanding.getOrCreate(match.tournament, match.tournamentPhase);
      await ps.recalculate();
    } catch (e) { console.error('Standing recalc error:', e); }

    // Update registration stats
    try {
      for (const r of match.results) {
        await Registration.updateOne(
          { tournament: match.tournament, team: r.team },
          { $inc: { totalTournamentPoints: r.points.totalPoints, totalTournamentKills: r.kills.total, matchesPlayed: 1, totalChickenDinners: r.chickenDinner ? 1 : 0 } }
        );
      }
    } catch (e) { console.error('Registration update error:', e); }

    res.json({ message: 'Match finalized', match });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ error: 'Failed to finalize match' });
  }
});

// ===================== LIVE SCORING =====================

// Start live scoring
router.post('/matches/:id/live/start', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.status = 'in_progress';
    match.liveState = {
      isLiveScoring: true, totalTeams: match.results.length,
      teamsAlive: match.results.length, eliminationCount: 0,
      lastUpdatedAt: new Date(), lastUpdatedBy: req.admin.adminId,
    };
    for (const r of match.results) { r.isEliminated = false; r.eliminationOrder = null; }
    await match.save();

    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:update', { matchId: id, match, event: 'started' });

    res.json({ message: 'Live scoring started', match });
  } catch (error) {
    console.error('Live start error:', error);
    res.status(500).json({ error: 'Failed to start live scoring' });
  }
});

// Add kill — "Player X finishes Player Y" style
// Body: { teamId, playerId, kills: 1 } — just add kills to a player
router.post('/matches/:id/live/kill', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId, playerId, kills = 1 } = req.body;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match || !match.liveState?.isLiveScoring) return res.status(400).json({ error: 'Match not in live scoring mode' });

    const teamResult = match.results.find(r => r.team.toString() === teamId);
    if (!teamResult) return res.status(404).json({ error: 'Team not found in match' });
    if (teamResult.isEliminated) return res.status(400).json({ error: 'Team is already eliminated' });

    // Update player kills
    if (playerId && isValidId(playerId)) {
      const playerEntry = teamResult.kills.breakdown.find(b => b.player?.toString() === playerId);
      if (playerEntry) { playerEntry.kills += kills; }
      else { teamResult.kills.breakdown.push({ player: playerId, kills, isPlaying: true }); }
    }

    // Recalculate team total kills
    teamResult.kills.total = teamResult.kills.breakdown.reduce((sum, b) => sum + b.kills, 0);
    match.liveState.lastUpdatedAt = new Date();
    match.liveState.lastUpdatedBy = req.admin.adminId;
    await match.save();

    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:kill', { matchId: id, teamId, playerId, playerKills: kills, teamTotalKills: teamResult.kills.total });

    res.json({ message: 'Kill recorded', teamKills: teamResult.kills.total, match });
  } catch (error) {
    console.error('Live kill error:', error);
    res.status(500).json({ error: 'Failed to record kill' });
  }
});

// Eliminate team — auto-assigns position based on elimination order
router.post('/matches/:id/live/eliminate', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId } = req.body;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match || !match.liveState?.isLiveScoring) return res.status(400).json({ error: 'Match not in live scoring mode' });

    const teamResult = match.results.find(r => r.team.toString() === teamId);
    if (!teamResult) return res.status(404).json({ error: 'Team not found in match' });
    if (teamResult.isEliminated) return res.status(400).json({ error: 'Team already eliminated' });

    // Mark eliminated
    match.liveState.eliminationCount += 1;
    match.liveState.teamsAlive -= 1;
    teamResult.isEliminated = true;
    teamResult.eliminationOrder = match.liveState.eliminationCount;

    // Auto-assign position: first eliminated = last place, etc.
    const totalTeams = match.liveState.totalTeams;
    teamResult.finalPosition = totalTeams - match.liveState.eliminationCount + 1;

    // Check if only 1 team left = chicken dinner
    if (match.liveState.teamsAlive === 1) {
      const winner = match.results.find(r => !r.isEliminated);
      if (winner) {
        winner.finalPosition = 1;
        winner.chickenDinner = true;
        winner.isEliminated = true;
        winner.eliminationOrder = match.liveState.eliminationCount + 1;
        match.liveState.teamsAlive = 0;
        match.liveState.eliminationCount += 1;
      }
    }

    match.liveState.lastUpdatedAt = new Date();
    match.liveState.lastUpdatedBy = req.admin.adminId;
    await match.save();

    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:eliminate', { matchId: id, teamId, position: teamResult.finalPosition, teamsAlive: match.liveState.teamsAlive });

    // If all teams eliminated, auto-end
    if (match.liveState.teamsAlive === 0) {
      if (io) io.to(`match:${id}`).emit('match:ended', { matchId: id });
    }

    res.json({ message: 'Team eliminated', position: teamResult.finalPosition, teamsAlive: match.liveState.teamsAlive, match });
  } catch (error) {
    console.error('Live eliminate error:', error);
    res.status(500).json({ error: 'Failed to eliminate team' });
  }
});

// End live scoring
router.post('/matches/:id/live/end', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.liveState.isLiveScoring = false;
    match.liveState.lastUpdatedAt = new Date();

    // Auto-assign remaining positions for non-eliminated teams
    const uneliminated = match.results.filter(r => !r.isEliminated);
    if (uneliminated.length > 0) {
      let nextPos = 1;
      for (const r of uneliminated) {
        r.finalPosition = nextPos++;
        r.isEliminated = true;
        if (nextPos === 2) r.chickenDinner = true;
      }
    }

    await match.save();
    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:ended', { matchId: id, match });
    res.json({ message: 'Live scoring ended', match });
  } catch (error) {
    console.error('Live end error:', error);
    res.status(500).json({ error: 'Failed to end live scoring' });
  }
});

// Get live match state
router.get('/matches/:id/live', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id)
      .populate('results.team', 'teamName teamTag logo')
      .populate('results.kills.breakdown.player', 'username realName gameIds profilePicture');
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ match });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live state' });
  }
});

// Search real players (for claim flow)
router.get('/players/search', verifyAdminToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query too short' });
    const players = await Player.find({
      isShadowProfile: false,
      $or: [
        { username: { $regex: sanitize(q), $options: 'i' } },
        { email: { $regex: sanitize(q), $options: 'i' } },
        { 'gameIds.inGameName': { $regex: sanitize(q), $options: 'i' } },
      ],
    }).select('username email realName profilePicture gameIds aegisRating').limit(20).lean();
    res.json({ players });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
