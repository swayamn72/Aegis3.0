import express from 'express';
import mongoose from 'mongoose';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Match from '../models/match.model.js';
import LiveMatchState from '../models/liveMatchState.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import { verifyAdminToken } from '../middleware/adminAuth.js';
import { claimShadowProfile } from '../services/shadowClaim.service.js';
import { getGameConfig } from '../config/gameRegistry.js';
import rateLimit from 'express-rate-limit';
import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const sanitize = (s) => (typeof s === 'string' ? s.trim().replace(/[<>]/g, '') : '');

const actionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

// ===================== SHADOW PLAYER CRUD =====================

// Create shadow player
router.post('/players/shadow', verifyAdminToken, upload.single('profilePicture'), actionLimiter, async (req, res) => {
  try {
    const { realName, inGameName, characterId, inGameRole, teamId } = req.body;
    let profilePicture = req.body.profilePicture || '';

    if (!inGameName) {
      return res.status(400).json({ error: 'inGameName is required' });
    }
    // Only check duplicates if characterId is provided
    if (characterId) {
      const existing = await Player.findOne({ 'gameIds.characterId': sanitize(characterId), isShadowProfile: true, claimedBy: null });
      if (existing) return res.status(409).json({ error: 'Shadow player with this characterId already exists' });
    }

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'aegis_profiles', transformation: [{ width: 400, height: 400, crop: "fill" }] },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      profilePicture = uploadResult.secure_url;
    }

    const player = await Player.create({
      isShadowProfile: true,
      shadowCreatedBy: req.admin.adminId,
      realName: sanitize(realName || ''),
      gameIds: [{ inGameName: sanitize(inGameName), ...(characterId ? { characterId: sanitize(characterId) } : {}), isPrimary: true }],
      inGameRole: inGameRole || [],
      profilePicture: profilePicture,
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
      Player.find(query).sort({ createdAt: -1 }).skip(skip).limit(+limit).populate('claimedBy', 'username email').lean(),
      Player.countDocuments(query),
    ]);

    // Assign backward-compat `team` field dynamically since we used .lean() and the `team` virtual isn't automatically added
    const playersWithTeam = players.map(p => {
      let activeTeam = null;
      if (p.teams) {
        // Find BGMI team as primary, or fallback to the first one available
        activeTeam = p.teams['BGMI'] && typeof p.teams['BGMI'] === 'object' ? p.teams['BGMI'] : Object.values(p.teams)[0];
      }
      return { ...p, team: activeTeam || null };
    });

    res.json({ players: playersWithTeam, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) } });
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

// Create team with up to 4 shadow players simultaneously
router.post('/teams/shadow-with-players', verifyAdminToken, upload.single('logo'), actionLimiter, async (req, res) => {
  try {
    const { teamName, teamTag, primaryGame, region } = req.body;
    let logo = '';

    if (!teamName) return res.status(400).json({ error: 'teamName is required' });

    // Parse players array from formData
    let playersData = [];
    try {
      playersData = req.body.players ? JSON.parse(req.body.players) : [];
    } catch (e) {
      return res.status(400).json({ error: 'Invalid players data' });
    }

    if (playersData.length === 0) return res.status(400).json({ error: 'At least 1 player is required' });

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'aegis_logos', transformation: [{ width: 400, height: 400, crop: "fill" }] },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      logo = uploadResult.secure_url;
    }

    // Generate unique teamId
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let teamId;
    let attempts = 0;
    do {
      teamId = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      attempts++;
    } while (await Team.findOne({ teamId }) && attempts < 10);

    // Create the team first to get the _id for players
    const team = await Team.create({
      teamId,
      teamName: sanitize(teamName),
      teamTag: sanitize(teamTag || teamName.slice(0, 4).toUpperCase()),
      logo: logo || 'https://placehold.co/200x200/1a1a1a/ffffff?text=TEAM',
      primaryGame: primaryGame || 'BGMI',
      region: region || 'India',
      status: 'active',
      captain: null, // Will update below
      players: []
    });

    // Create shadow players
    const createdPlayerIds = [];
    for (const p of playersData) {
      if (!p.inGameName) continue; // skip empty entries

      const newPlayer = await Player.create({
        username: `shadow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        realName: sanitize(p.realName || ''),
        gameIds: [{ gameTitle: primaryGame || 'BGMI', inGameName: sanitize(p.inGameName), characterId: sanitize(p.characterId || '') }],
        inGameRole: p.inGameRole ? [sanitize(p.inGameRole)] : [],
        isShadowProfile: true, // indicates it's an unclaimed profile
        primaryGame: primaryGame || 'BGMI',
        aegisRating: 1000
      });

      // Multi-game team membership syntax
      if (!newPlayer.teams) newPlayer.teams = new Map();
      newPlayer.teams.set(primaryGame || 'BGMI', team._id);
      await newPlayer.save();

      createdPlayerIds.push(newPlayer._id);
    }

    if (createdPlayerIds.length === 0) {
      await Team.findByIdAndDelete(team._id);
      return res.status(400).json({ error: 'Failed to create any valid players' });
    }

    // Update team with players and captain
    team.captain = createdPlayerIds[0];
    team.players = createdPlayerIds;
    await team.save();

    res.status(201).json({ message: 'Team and shadow players created successfully', team, playerCount: createdPlayerIds.length });
  } catch (error) {
    console.error('Create team+players error:', error);
    res.status(500).json({ error: error.message || 'Failed to create team and players' });
  }
});

router.post('/teams/create', verifyAdminToken, upload.single('logo'), actionLimiter, async (req, res) => {
  try {
    const { teamName, teamTag, primaryGame, region, playerIds, captainId } = req.body;
    let logo = req.body.logo || '';

    if (!teamName || !captainId) return res.status(400).json({ error: 'teamName and captainId required' });
    if (!isValidId(captainId)) return res.status(400).json({ error: 'Invalid captainId' });

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'aegis_logos', transformation: [{ width: 400, height: 400, crop: "fill" }] },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      logo = uploadResult.secure_url;
    }

    // Generate a unique 6-char team ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let teamId;
    let attempts = 0;
    do {
      teamId = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      attempts++;
    } while (await Team.findOne({ teamId }) && attempts < 10);

    // If playerIds is a string (from FormData), parse it to array if needed.
    // Let's ensure it's an array.
    let parsedPlayerIds = playerIds;
    if (typeof parsedPlayerIds === 'string') {
      try { parsedPlayerIds = JSON.parse(parsedPlayerIds); } catch (e) { parsedPlayerIds = [parsedPlayerIds]; }
    }

    const players = (parsedPlayerIds || []).filter(isValidId);
    if (!players.includes(captainId)) players.push(captainId);

    const team = await Team.create({
      teamId, teamName: sanitize(teamName), teamTag: sanitize(teamTag || teamName.slice(0, 4).toUpperCase()),
      logo: logo, primaryGame: primaryGame || 'BGMI', region: region || 'India',
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

// List matches (with optional tournament filter, status filter, phase filter)
router.get('/matches', verifyAdminToken, async (req, res) => {
  try {
    const { tournament, status, phase, limit = 50, page = 1 } = req.query;
    const query = {};
    if (tournament && isValidId(tournament)) query.tournament = tournament;
    if (status) query.status = status;
    if (phase) query.tournamentPhase = phase;

    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const [matches, total] = await Promise.all([
      Match.find(query)
        .sort({ matchNumber: 1, scheduledStartTime: 1 })
        .skip(skip)
        .limit(+limit)
        .populate('tournament', 'tournamentName gameTitle')
        .populate('results.team', 'teamName teamTag logo')
        .lean(),
      Match.countDocuments(query),
    ]);
    res.json({ matches, total, page: +page });
  } catch (error) {
    console.error('List matches error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get matches for a specific tournament
router.get('/tournaments/:tid/matches', verifyAdminToken, async (req, res) => {
  try {
    const { tid } = req.params;
    if (!isValidId(tid)) return res.status(400).json({ error: 'Invalid tournament ID' });
    const matches = await Match.find({ tournament: tid })
      .sort({ matchNumber: 1 })
      .populate('results.team', 'teamName teamTag logo')
      .lean();
    res.json({ matches });
  } catch (error) {
    console.error('Get tournament matches error:', error);
    res.status(500).json({ error: 'Failed to fetch tournament matches' });
  }
});

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

    const io = req.app.get('io');
    if (io) {
      await match.populate([
        { path: 'tournament', select: 'tournamentName logo' },
        { path: 'results.team', select: 'teamName teamTag logo' },
        { path: 'results.kills.breakdown.player', select: 'username inGameName profilePicture' }
      ]);
      io.to(`match:${id}`).emit('match:update', { matchId: id, match, event: 'results_updated' });
    }

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
    const gameConfig = getGameConfig(match.gameTitle || 'BGMI');
    const posPoints = gameConfig?.scoring?.positionPoints || {};
    const killPointValue = gameConfig?.scoring?.killPointValue || 1;

    for (const r of match.results) {
      if (r.finalPosition) {
        r.points.placementPoints = posPoints[r.finalPosition] || 0;
        r.points.killPoints = (r.kills?.total || 0) * killPointValue;
        r.points.totalPoints = r.points.placementPoints + r.points.killPoints;
        r.chickenDinner = r.finalPosition === 1;
      }
    }

    match.status = 'completed';
    match.liveState = { isLiveScoring: false, lastUpdatedAt: new Date() };
    await match.save();
    await LiveMatchState.deleteOne({ match: id });

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

    const io = req.app.get('io');
    if (io) {
      await match.populate([
        { path: 'tournament', select: 'tournamentName logo' },
        { path: 'results.team', select: 'teamName teamTag logo' },
        { path: 'results.kills.breakdown.player', select: 'username inGameName profilePicture' }
      ]);
      io.to(`match:${id}`).emit('match:update', { matchId: id, match, event: 'finalized' });
    }

    res.json({ message: 'Match finalized', match });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ error: 'Failed to finalize match' });
  }
});

// ===================== LIVE SCORING =====================

const buildLiveStateFromMatch = (match) => {
  const teams = (match.results || []).map((r) => {
    const players = (r.kills?.breakdown || [])
      .filter((b) => b.isPlaying !== false)
      .map((b) => ({ player: b.player, status: 'alive' }));
    return { team: r.team, players };
  });

  return {
    match: match._id,
    gameTitle: match.gameTitle || 'BGMI',
    teams,
  };
};

const syncMatchPoints = (match) => {
  const gameConfig = getGameConfig(match.gameTitle || 'BGMI');
  const posPoints = gameConfig?.scoring?.positionPoints || {};
  const killPointValue = gameConfig?.scoring?.killPointValue || 1;

  for (const r of match.results) {
    if (!r.points) r.points = { placementPoints: 0, killPoints: 0, totalPoints: 0 };
    r.points.killPoints = (r.kills?.total || 0) * killPointValue;
    if (r.finalPosition) {
      r.points.placementPoints = posPoints[r.finalPosition] || 0;
    } else {
      r.points.placementPoints = 0;
    }
    r.points.totalPoints = r.points.placementPoints + r.points.killPoints;
  }
};

const findLivePlayer = (liveState, teamId, playerId) => {
  const team = liveState.teams.find((t) => t.team.toString() === teamId);
  if (!team) return { team: null, player: null };
  const player = team.players.find((p) => p.player.toString() === playerId);
  return { team, player };
};

const emitLiveState = (req, matchId, match, live) => {
  const io = req.app.get('io');
  if (!io) return;

  // Asynchronously populate the existing match document in-memory
  // This avoids a redundant database query bottleneck!
  match.populate([
    { path: 'tournament', select: 'tournamentName logo' },
    { path: 'results.team', select: 'teamName teamTag logo' },
    { path: 'results.kills.breakdown.player', select: 'username inGameName profilePicture' }
  ])
    .then((populatedMatch) => {
      io.to(`match:${matchId}`).emit('match:state', {
        matchId,
        match: populatedMatch,
        live,
      });
    })
    .catch((err) => {
      console.error('Socket match population error:', err);
      // Fallback
      io.to(`match:${matchId}`).emit('match:state', { matchId, match, live });
    });
};

// Start live scoring
router.post('/matches/:id/live/start', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.status = 'in_progress';
    match.liveState = {
      isLiveScoring: true,
      totalTeams: match.results.length,
      teamsAlive: match.results.length,
      eliminationCount: 0,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.admin.adminId,
    };
    for (const r of match.results) {
      r.isEliminated = false;
      r.eliminationOrder = null;
    }
    await match.save();

    const liveState = await LiveMatchState.findOneAndUpdate(
      { match: id },
      {
        ...buildLiveStateFromMatch(match),
        lastUpdatedAt: new Date(),
        lastUpdatedBy: req.admin.adminId,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    emitLiveState(req, id, match, liveState);

    res.json({ message: 'Live scoring started', match, live: liveState });
  } catch (error) {
    console.error('Live start error:', error);
    res.status(500).json({ error: 'Failed to start live scoring' });
  }
});

// Mark a player as knocked (no points awarded)
// Body: { teamId, playerId }
router.post('/matches/:id/live/knock', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId, playerId } = req.body;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match || !match.liveState?.isLiveScoring) return res.status(400).json({ error: 'Match not in live scoring mode' });
    if (!isValidId(teamId) || !isValidId(playerId)) return res.status(400).json({ error: 'Invalid teamId or playerId' });

    const liveState = await LiveMatchState.findOne({ match: id });
    if (!liveState) return res.status(400).json({ error: 'Live state not initialized' });

    const { team, player } = findLivePlayer(liveState, teamId, playerId);
    if (!team) return res.status(404).json({ error: 'Team not found in live state' });

    const previousStatus = player ? player.status : 'alive';
    if (player) {
      if (player.status === 'eliminated') return res.status(400).json({ error: 'Player already eliminated' });
      player.status = 'knocked';
    } else {
      team.players.push({ player: playerId, status: 'knocked' });
    }

    if (!liveState.actionLog) liveState.actionLog = [];
    liveState.actionLog.push({
      actionType: 'knock',
      payload: { teamId, playerId, previousStatus, isPlayzone: req.body.isPlayzone }
    });

    liveState.lastUpdatedAt = new Date();
    liveState.lastUpdatedBy = req.admin.adminId;
    await liveState.save();

    emitLiveState(req, id, match, liveState);
    res.json({ message: 'Player knocked', live: liveState });
  } catch (error) {
    console.error('Live knock error:', error);
    res.status(500).json({ error: 'Failed to record knock' });
  }
});

// Finish a player (adds kill points)
// Body: { killerTeamId, killerPlayerId, victimTeamId, victimPlayerId }
router.post('/matches/:id/live/finish', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { killerTeamId, killerPlayerId, victimTeamId, victimPlayerId, isPlayzone } = req.body;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    if (!isValidId(victimTeamId) || !isValidId(victimPlayerId)) {
      return res.status(400).json({ error: 'Invalid victim IDs' });
    }
    if (!isPlayzone && (!isValidId(killerTeamId) || !isValidId(killerPlayerId))) {
      return res.status(400).json({ error: 'Invalid killer IDs' });
    }

    const match = await Match.findById(id);
    if (!match || !match.liveState?.isLiveScoring) return res.status(400).json({ error: 'Match not in live scoring mode' });

    const liveState = await LiveMatchState.findOne({ match: id });
    if (!liveState) return res.status(400).json({ error: 'Live state not initialized' });

    const { team: victimTeam, player: victimPlayer } = findLivePlayer(liveState, victimTeamId, victimPlayerId);
    if (!victimTeam) return res.status(404).json({ error: 'Victim team not found in live state' });
    if (victimPlayer?.status === 'eliminated') return res.status(400).json({ error: 'Player already eliminated' });

    const actionPayload = {
      isPlayzone,
      killerTeamId: isPlayzone ? null : killerTeamId,
      killerPlayerId: isPlayzone ? null : killerPlayerId,
      victimTeamId, victimPlayerId,
      victimPreviousStatus: victimPlayer ? victimPlayer.status : 'alive',
      teamEliminated: false,
      finalPosition: null,
      chickenDinnerAwardedTo: null
    };

    if (victimPlayer) {
      victimPlayer.status = 'eliminated';
    } else {
      victimTeam.players.push({ player: victimPlayerId, status: 'eliminated' });
    }

    // Update killer stats
    if (!isPlayzone) {
      const killerResult = match.results.find((r) => r.team.toString() === killerTeamId);
      if (!killerResult) return res.status(404).json({ error: 'Killer team not found in match' });

      const killerEntry = killerResult.kills?.breakdown?.find((b) => b.player?.toString() === killerPlayerId);
      if (killerEntry) {
        killerEntry.kills += 1;
      } else {
        if (!killerResult.kills?.breakdown) killerResult.kills.breakdown = [];
        killerResult.kills.breakdown.push({ player: killerPlayerId, kills: 1, isPlaying: true });
      }
      killerResult.kills.total = (killerResult.kills?.breakdown || []).reduce((sum, b) => sum + b.kills, 0);
      match.matchStats.totalKills = (match.matchStats?.totalKills || 0) + 1;
    }

    // If entire active squad (4 players) or all tracked players eliminated, set final position
    const eliminatedCount = victimTeam.players.filter((p) => p.status === 'eliminated').length;
    const remaining = victimTeam.players.filter((p) => p.status !== 'eliminated');

    if (remaining.length === 0 || eliminatedCount >= 4) {
      // Ensure all players are marked eliminated if team is wiped
      victimTeam.players.forEach(p => { p.status = 'eliminated'; });
      const victimResult = match.results.find((r) => r.team.toString() === victimTeamId);
      if (victimResult && !victimResult.isEliminated) {
        actionPayload.teamEliminated = true;

        match.liveState.eliminationCount += 1;
        match.liveState.teamsAlive -= 1;
        victimResult.isEliminated = true;
        victimResult.eliminationOrder = match.liveState.eliminationCount;

        const totalTeams = match.liveState.totalTeams;
        victimResult.finalPosition = totalTeams - match.liveState.eliminationCount + 1;
        actionPayload.finalPosition = victimResult.finalPosition;
      }

      if (match.liveState.teamsAlive === 1) {
        const winner = match.results.find((r) => !r.isEliminated);
        if (winner) {
          actionPayload.chickenDinnerAwardedTo = winner.team.toString();

          winner.finalPosition = 1;
          winner.chickenDinner = true;
          winner.isEliminated = true;
          winner.eliminationOrder = match.liveState.eliminationCount + 1;
          match.liveState.teamsAlive = 0;
          match.liveState.eliminationCount += 1;
        }
      }
    }

    if (!liveState.actionLog) liveState.actionLog = [];
    liveState.actionLog.push({
      actionType: 'finish',
      payload: actionPayload
    });

    liveState.lastUpdatedAt = new Date();
    liveState.lastUpdatedBy = req.admin.adminId;
    match.liveState.lastUpdatedAt = new Date();
    match.liveState.lastUpdatedBy = req.admin.adminId;

    syncMatchPoints(match);
    await Promise.all([liveState.save(), match.save()]);

    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:finish', { matchId: id, killerTeamId, killerPlayerId, victimTeamId, victimPlayerId });
    emitLiveState(req, id, match, liveState);

    res.json({ message: 'Finish recorded', match, live: liveState });
  } catch (error) {
    console.error('Live finish error:', error);
    res.status(500).json({ error: 'Failed to record finish' });
  }
});

// Revive a knocked player
// Body: { teamId, playerId }
router.post('/matches/:id/live/revive', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId, playerId } = req.body;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match || !match.liveState?.isLiveScoring) return res.status(400).json({ error: 'Match not in live scoring mode' });
    if (!isValidId(teamId) || !isValidId(playerId)) return res.status(400).json({ error: 'Invalid teamId or playerId' });

    const liveState = await LiveMatchState.findOne({ match: id });
    if (!liveState) return res.status(400).json({ error: 'Live state not initialized' });

    const { team, player } = findLivePlayer(liveState, teamId, playerId);
    if (!team) return res.status(404).json({ error: 'Team not found in live state' });
    if (!player) return res.status(404).json({ error: 'Player not found in live state' });
    if (player.status === 'eliminated') return res.status(400).json({ error: 'Player already eliminated' });

    const previousStatus = player.status;
    player.status = 'alive';

    if (!liveState.actionLog) liveState.actionLog = [];
    liveState.actionLog.push({
      actionType: 'revive',
      payload: { teamId, playerId, previousStatus }
    });

    liveState.lastUpdatedAt = new Date();
    liveState.lastUpdatedBy = req.admin.adminId;
    await liveState.save();

    emitLiveState(req, id, match, liveState);
    res.json({ message: 'Player revived', live: liveState });
  } catch (error) {
    console.error('Live revive error:', error);
    res.status(500).json({ error: 'Failed to revive player' });
  }
});
// Undo last live scoring action
router.post('/matches/:id/live/undo', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid match ID' });
    const match = await Match.findById(id);
    if (!match || !match.liveState?.isLiveScoring) return res.status(400).json({ error: 'Match not in live scoring mode' });

    const liveState = await LiveMatchState.findOne({ match: id });
    if (!liveState) return res.status(400).json({ error: 'Live state not initialized' });

    if (!liveState.actionLog || liveState.actionLog.length === 0) {
      return res.status(400).json({ error: 'No actions to undo' });
    }

    const lastAction = liveState.actionLog.pop();
    const { actionType, payload } = lastAction;

    if (actionType === 'knock') {
      const { player } = findLivePlayer(liveState, payload.teamId, payload.playerId);
      if (player) player.status = payload.previousStatus || 'alive';
    }
    else if (actionType === 'revive') {
      const { player } = findLivePlayer(liveState, payload.teamId, payload.playerId);
      if (player) player.status = payload.previousStatus || 'knocked';
    }
    else if (actionType === 'finish') {
      const { killerTeamId, killerPlayerId, victimTeamId, victimPlayerId, victimPreviousStatus, teamEliminated, chickenDinnerAwardedTo } = payload;

      const { player: victimPlayer } = findLivePlayer(liveState, victimTeamId, victimPlayerId);
      if (victimPlayer) victimPlayer.status = victimPreviousStatus || 'knocked';

      if (!payload.isPlayzone) {
        const killerResult = match.results.find((r) => r.team.toString() === killerTeamId);
        if (killerResult) {
          const killerEntry = killerResult.kills?.breakdown?.find((b) => b.player?.toString() === killerPlayerId);
          if (killerEntry && killerEntry.kills > 0) killerEntry.kills -= 1;
          killerResult.kills.total = Math.max(0, killerResult.kills.total - 1);
          match.matchStats.totalKills = Math.max(0, (match.matchStats?.totalKills || 0) - 1);
        }
      }

      if (teamEliminated) {
        const victimResult = match.results.find((r) => r.team.toString() === victimTeamId);
        if (victimResult) {
          victimResult.isEliminated = false;
          victimResult.finalPosition = null;
          victimResult.eliminationOrder = null;
          match.liveState.eliminationCount = Math.max(0, match.liveState.eliminationCount - 1);
          match.liveState.teamsAlive += 1;
        }

        if (chickenDinnerAwardedTo) {
          const winnerResult = match.results.find((r) => r.team.toString() === chickenDinnerAwardedTo);
          if (winnerResult) {
            winnerResult.finalPosition = null;
            winnerResult.chickenDinner = false;
            winnerResult.isEliminated = false;
            winnerResult.eliminationOrder = null;
            match.liveState.eliminationCount = Math.max(0, match.liveState.eliminationCount - 1);
            match.liveState.teamsAlive -= 1;
          }
        }
      }
    }

    liveState.lastUpdatedAt = new Date();
    liveState.lastUpdatedBy = req.admin.adminId;
    match.liveState.lastUpdatedAt = new Date();
    match.liveState.lastUpdatedBy = req.admin.adminId;

    syncMatchPoints(match);
    await Promise.all([liveState.save(), match.save()]);

    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:undo', { matchId: id, actionType });
    emitLiveState(req, id, match, liveState);

    res.json({ message: `Undo successful: ${actionType}`, match, live: liveState });
  } catch (error) {
    console.error('Live undo error:', error);
    res.status(500).json({ error: 'Failed to undo action' });
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

    const liveState = await LiveMatchState.findOne({ match: id });
    if (!liveState) return res.status(400).json({ error: 'Live state not initialized' });

    const liveTeam = liveState.teams.find(t => t.team.toString() === teamId);
    if (liveTeam) {
      liveTeam.players.forEach((p) => { p.status = 'eliminated'; });
    }

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
    liveState.lastUpdatedAt = new Date();
    liveState.lastUpdatedBy = req.admin.adminId;

    syncMatchPoints(match);
    await Promise.all([match.save(), liveState.save()]);

    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:eliminate', { matchId: id, teamId, position: teamResult.finalPosition, teamsAlive: match.liveState.teamsAlive });

    emitLiveState(req, id, match, liveState);

    // If all teams eliminated, auto-end
    if (match.liveState.teamsAlive === 0) {
      if (io) io.to(`match:${id}`).emit('match:ended', { matchId: id });
    }

    res.json({ message: 'Team eliminated', position: teamResult.finalPosition, teamsAlive: match.liveState.teamsAlive, match, live: liveState });
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

    match.liveState = { isLiveScoring: false, lastUpdatedAt: new Date() };

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
    await LiveMatchState.deleteOne({ match: id });
    const io = req.app.get('io');
    if (io) io.to(`match:${id}`).emit('match:ended', { matchId: id, match });
    emitLiveState(req, id, match, null);
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
    const live = await LiveMatchState.findOne({ match: id })
      .populate('teams.team', 'teamName teamTag logo')
      .populate('teams.players.player', 'username realName gameIds profilePicture');
    res.json({ match, live });
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

// ===================== TEAM SEARCH =====================
router.get('/teams/search', verifyAdminToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query too short' });
    const s = sanitize(q);
    const teams = await Team.find({
      $or: [
        { teamName: { $regex: s, $options: 'i' } },
        { teamTag: { $regex: s, $options: 'i' } },
        { teamId: { $regex: s, $options: 'i' } },
      ],
    }).select('teamName teamTag teamId logo primaryGame players captain aegisRating').populate('players', 'gameIds realName').limit(20).lean();
    res.json({ teams });
  } catch (error) {
    console.error('Team search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ===================== TOURNAMENT TEAM MANAGEMENT =====================

// List registrations for a tournament
router.get('/tournaments/:id/registrations', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid tournament ID' });
    const registrations = await Registration.find({ tournament: id })
      .populate('team', 'teamName teamTag teamId logo primaryGame players aegisRating')
      .populate('roster.player', 'gameIds realName profilePicture')
      .sort({ registeredAt: -1 })
      .lean();
    res.json({ registrations });
  } catch (error) {
    console.error('List registrations error:', error);
    res.status(500).json({ error: 'Failed to list registrations' });
  }
});

// Admin-register a team to a tournament (direct seed, auto-approved)
router.post('/tournaments/:id/admin-register', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId } = req.body;
    if (!isValidId(id) || !isValidId(teamId)) return res.status(400).json({ error: 'Invalid IDs' });

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const team = await Team.findById(teamId).populate('players', '_id gameIds realName');
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check if already registered
    const existing = await Registration.findOne({ tournament: id, team: teamId });
    if (existing) return res.status(409).json({ error: 'Team already registered' });

    // Build roster from team players
    const roster = (team.players || []).map(p => ({
      player: p._id,
      inGameName: p.gameIds?.[0]?.inGameName || p.realName || '',
    }));

    // Assign to first phase if available
    const firstPhase = tournament.phases?.[0];
    const phaseName = firstPhase?.name || null;

    const registration = await Registration.create({
      tournament: id,
      team: teamId,
      gameTitle: tournament.gameTitle,
      status: 'approved',
      qualifiedThrough: 'direct_seed',
      phase: phaseName,
      currentStage: phaseName,
      roster,
      registeredAt: new Date(),
      approvedAt: new Date(),
      isDirectInvite: true,
    });

    // Add team to first phase teams array
    if (firstPhase && !firstPhase.teams.some(t => t.toString() === teamId)) {
      firstPhase.teams.push(teamId);
      await tournament.save();
    }

    res.status(201).json({ message: 'Team registered', registration });
  } catch (error) {
    console.error('Admin register error:', error);
    res.status(500).json({ error: error.message || 'Failed to register team' });
  }
});

// Remove team from tournament
router.delete('/tournaments/:id/registrations/:teamId', verifyAdminToken, actionLimiter, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    if (!isValidId(id) || !isValidId(teamId)) return res.status(400).json({ error: 'Invalid IDs' });

    const reg = await Registration.findOneAndDelete({ tournament: id, team: teamId });
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    // Remove from phase teams arrays
    const tournament = await Tournament.findById(id);
    if (tournament) {
      for (const phase of tournament.phases) {
        phase.teams = phase.teams.filter(t => t.toString() !== teamId);
        for (const group of (phase.groups || [])) {
          group.teams = group.teams.filter(t => t.toString() !== teamId);
        }
      }
      await tournament.save();
    }

    res.json({ message: 'Registration removed' });
  } catch (error) {
    console.error('Remove registration error:', error);
    res.status(500).json({ error: 'Failed to remove registration' });
  }
});

// ===================== ADMIN PHASE ADVANCEMENT =====================

const getPlacementPoints = (position) => {
  const posPoints = { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 };
  return posPoints[position] || 0;
};

router.post('/tournaments/:id/advance-phase', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phaseName } = req.body;
    if (!isValidId(id) || !phaseName) return res.status(400).json({ error: 'Tournament ID and phaseName required' });

    const tournament = await Tournament.findById(id).populate('phases.teams', 'teamName teamTag logo');
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.status === 'completed') return res.status(400).json({ error: 'Tournament already completed' });

    const phaseIndex = tournament.phases.findIndex(p => p.name === phaseName);
    if (phaseIndex === -1) return res.status(404).json({ error: 'Phase not found' });

    const currentPhase = tournament.phases[phaseIndex];
    if (currentPhase.status === 'completed') return res.status(400).json({ error: 'Phase already completed' });

    // Ensure previous phases are completed
    for (let i = 0; i < phaseIndex; i++) {
      if (tournament.phases[i].status !== 'completed') {
        return res.status(400).json({ error: `Previous phase "${tournament.phases[i].name}" must be completed first` });
      }
    }

    // Fetch matches for this phase
    const matches = await Match.find({ tournament: id, tournamentPhase: phaseName }).populate('results.team', 'teamName teamTag logo').lean();

    // Auto-complete uncompleted matches
    await Match.updateMany(
      { tournament: id, tournamentPhase: phaseName, status: { $ne: 'completed' } },
      { $set: { status: 'completed' } }
    );

    // Get phase registrations
    const phaseRegs = await Registration.find({
      tournament: id, phase: phaseName, status: { $in: ['approved', 'checked_in'] }
    }).select('team group').lean();

    const phaseTeamIds = phaseRegs.map(r => r.team.toString());
    const regGroupMap = {};
    phaseRegs.forEach(r => { if (r.group) regGroupMap[r.team.toString()] = r.group; });

    // Phase group map fallback
    const phaseGroupMap = {};
    (currentPhase.groups || []).forEach(g => {
      (g.teams || []).forEach(t => { phaseGroupMap[t.toString()] = g.name; });
    });

    // Build standings
    const phaseTeams = await Team.find({ _id: { $in: phaseTeamIds } }).select('teamName teamTag logo').lean();
    const teamStandings = {};
    for (const team of phaseTeams) {
      const tid = team._id.toString();
      teamStandings[tid] = { team, teamId: tid, points: 0, positionPoints: 0, killPoints: 0, kills: 0, chickenDinners: 0, matchesPlayed: 0, placements: [], group: regGroupMap[tid] || phaseGroupMap[tid] || null };
    }

    matches.forEach(match => {
      (match.results || []).forEach(r => {
        const tid = (r.team?._id || r.team)?.toString();
        if (tid && teamStandings[tid]) {
          const pos = r.finalPosition;
          const kills = r.kills?.total || 0;
          if (pos || kills > 0) {
            const pp = getPlacementPoints(pos);
            teamStandings[tid].positionPoints += pp;
            teamStandings[tid].killPoints += kills;
            teamStandings[tid].points += pp + kills;
            teamStandings[tid].kills += kills;
            teamStandings[tid].matchesPlayed += 1;
            if (pos) teamStandings[tid].placements.push(pos);
            if (r.chickenDinner) teamStandings[tid].chickenDinners += 1;
          }
        }
      });
    });

    const overallStandings = Object.values(teamStandings).sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.positionPoints !== b.positionPoints) return b.positionPoints - a.positionPoints;
      if (a.chickenDinners !== b.chickenDinners) return b.chickenDinners - a.chickenDinners;
      return b.kills - a.kills;
    });
    overallStandings.forEach((s, i) => { s.position = i + 1; });

    // Group standings
    const standingsByGroup = {};
    overallStandings.forEach(s => {
      if (s.group) {
        if (!standingsByGroup[s.group]) standingsByGroup[s.group] = [];
        standingsByGroup[s.group].push(s);
      }
    });

    // Mark phase completed
    currentPhase.status = 'completed';
    const advancementDetails = [];
    const teamsAdvanced = [];

    if (phaseIndex + 1 < tournament.phases.length) {
      // Advance teams
      if (currentPhase.qualificationRules?.length > 0) {
        const qualifiedSet = new Set();
        for (const rule of currentPhase.qualificationRules) {
          const num = rule.numberOfTeams || 0;
          const source = rule.source || 'overall';
          const nextPhaseName = rule.nextPhase;
          const nextPhaseIdx = tournament.phases.findIndex(p => p.name === nextPhaseName);
          if (nextPhaseIdx === -1) continue;
          const nextPhase = tournament.phases[nextPhaseIdx];
          let qualified = [];

          if (source === 'overall') {
            qualified = overallStandings.slice(0, num).map(s => s.teamId);
          } else if (source === 'from_each_group') {
            Object.values(standingsByGroup).forEach(gs => {
              qualified.push(...gs.slice(0, num).map(s => s.teamId));
            });
            if (qualified.length === 0) qualified = overallStandings.slice(0, num).map(s => s.teamId);
          }

          qualified.forEach(t => qualifiedSet.add(t));
          if (!nextPhase.teams) nextPhase.teams = [];
          const newTeams = qualified.filter(t => !nextPhase.teams.some(x => x.toString() === t));
          nextPhase.teams.push(...newTeams);
          nextPhase.status = 'upcoming';
          advancementDetails.push({ rule: `${num} from ${source}`, nextPhase: nextPhaseName, teamsQualified: qualified.length });
        }
        teamsAdvanced.push(...Array.from(qualifiedSet));

        if (teamsAdvanced.length > 0) {
          const teamToPhase = {};
          for (const d of advancementDetails) {
            const np = tournament.phases.find(p => p.name === d.nextPhase);
            if (np) np.teams.forEach(t => { teamToPhase[t.toString()] = d.nextPhase; });
          }
          const bulkOps = teamsAdvanced.map(tid => ({
            updateOne: {
              filter: { tournament: id, team: tid, status: { $in: ['approved', 'checked_in'] } },
              update: { $set: { phase: teamToPhase[tid], currentStage: teamToPhase[tid] } },
            }
          }));
          await Registration.bulkWrite(bulkOps, { ordered: false });
        }
      } else {
        // No rules — advance all
        const nextPhase = tournament.phases[phaseIndex + 1];
        const allIds = overallStandings.map(s => s.teamId);
        if (!nextPhase.teams) nextPhase.teams = [];
        const newTeams = allIds.filter(t => !nextPhase.teams.some(x => x.toString() === t));
        nextPhase.teams.push(...newTeams);
        nextPhase.status = 'upcoming';
        teamsAdvanced.push(...allIds);
        await Registration.updateMany(
          { tournament: id, team: { $in: allIds }, status: { $in: ['approved', 'checked_in'] } },
          { $set: { phase: nextPhase.name, currentStage: nextPhase.name } }
        );
        advancementDetails.push({ rule: 'All teams advance', nextPhase: nextPhase.name, teamsQualified: allIds.length });
      }
    } else if (currentPhase.type === 'final_stage') {
      // Final phase — set final standings
      tournament.finalStandings = overallStandings.map((s, i) => ({
        position: i + 1, team: s.team._id || s.teamId, tournamentPointsAwarded: s.points,
      }));
      tournament.status = 'completed';
      await Registration.updateMany(
        { tournament: id, status: { $in: ['approved', 'checked_in'] } },
        { $set: { currentStage: 'Completed' } }
      );
      const posBulk = overallStandings.map((s, i) => ({
        updateOne: { filter: { tournament: id, team: s.teamId }, update: { $set: { finalPosition: i + 1 } } }
      }));
      if (posBulk.length > 0) await Registration.bulkWrite(posBulk, { ordered: false });
    } else {
      return res.status(400).json({ error: 'Last phase must be final_stage to conclude tournament' });
    }

    // Update PhaseStanding
    await PhaseStanding.findOneAndUpdate(
      { tournament: id, phase: phaseName },
      {
        $set: {
          status: 'completed',
          topTeams: overallStandings.map((s, i) => ({
            team: s.team._id || s.teamId, position: i + 1, points: s.points, kills: s.kills,
            positionPoints: s.positionPoints, killPoints: s.killPoints,
            chickenDinners: s.chickenDinners, matchesPlayed: s.matchesPlayed, group: s.group,
          })),
          statistics: {
            totalTeams: overallStandings.length, totalMatches: matches.length,
            totalPoints: overallStandings.reduce((sum, s) => sum + s.points, 0),
            totalKills: overallStandings.reduce((sum, s) => sum + s.kills, 0),
          },
          lastCalculated: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    await tournament.save();

    res.json({
      message: 'Phase advanced successfully',
      phase: { name: currentPhase.name, status: 'completed' },
      standings: overallStandings.map((s, i) => ({ position: i + 1, team: s.team, points: s.points, kills: s.kills, chickenDinners: s.chickenDinners, matchesPlayed: s.matchesPlayed })),
      advancement: { teamsAdvanced: teamsAdvanced.length, details: advancementDetails },
      tournamentStatus: tournament.status,
    });
  } catch (error) {
    console.error('Phase advance error:', error);
    res.status(500).json({ error: error.message || 'Failed to advance phase' });
  }
});

export default router;
