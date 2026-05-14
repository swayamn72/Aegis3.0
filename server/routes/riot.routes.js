/**
 * Riot API Routes — Profile data proxy for Valorant players
 *
 * Fetches and caches Valorant profile data (rank, agents, etc.)
 * from the Riot/Henrik API for display on player profiles.
 *
 * This is for PROFILE DISPLAY ONLY — tournament match results
 * are entered manually by tournament organizers.
 */

import express from 'express';
import auth from '../middleware/auth.js';
import Player from '../models/player.model.js';

const router = express.Router();

// Henrik Dev API (free tier, no Riot API key needed)
// Production: swap to official Riot API with proper key
const HENRIK_BASE = 'https://api.henrikdev.xyz/valorant/v1';
const HENRIK_V2 = 'https://api.henrikdev.xyz/valorant/v2';

// Cache duration: 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * GET /api/riot/profile/:name/:tag
 * Fetch Valorant account + MMR data
 */
router.get('/profile/:name/:tag', async (req, res) => {
  try {
    const { name, tag } = req.params;
    const region = req.query.region || 'ap'; // Default to Asia-Pacific for Indian players

    // Fetch account + MMR in parallel
    const [accountRes, mmrRes] = await Promise.all([
      fetch(`${HENRIK_BASE}/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`),
      fetch(`${HENRIK_BASE}/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`),
    ]);

    const accountData = await accountRes.json();
    const mmrData = await mmrRes.json();

    if (accountData.status !== 200) {
      return res.status(404).json({ error: 'Valorant account not found', details: accountData });
    }

    const profile = {
      puuid: accountData.data?.puuid,
      gameName: accountData.data?.name,
      tagLine: accountData.data?.tag,
      accountLevel: accountData.data?.account_level,
      card: accountData.data?.card,
      currentRank: mmrData.data?.currenttierpatched || 'Unranked',
      currentRankTier: mmrData.data?.currenttier || 0,
      rr: mmrData.data?.ranking_in_tier || 0,
      mmrChange: mmrData.data?.mmr_change_to_last_game || 0,
      elo: mmrData.data?.elo || 0,
    };

    res.json({ profile });
  } catch (error) {
    console.error('Riot API proxy error:', error.message);
    res.status(502).json({ error: 'Failed to fetch Valorant profile', details: error.message });
  }
});

/**
 * POST /api/riot/link
 * Link a Riot ID to the player's profile and cache rank data
 * Body: { riotId: "Name#Tag" }
 */
router.post('/link', auth, async (req, res) => {
  try {
    const playerId = req.user.id;
    const { riotId } = req.body;

    if (!riotId || !riotId.includes('#')) {
      return res.status(400).json({ error: 'Invalid Riot ID format. Use Name#Tag' });
    }

    const [name, tag] = riotId.split('#');

    // Verify the account exists
    const accountRes = await fetch(
      `${HENRIK_BASE}/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    );
    const accountData = await accountRes.json();

    if (accountData.status !== 200) {
      return res.status(404).json({ error: 'Valorant account not found. Check the Riot ID.' });
    }

    // Fetch MMR
    const mmrRes = await fetch(
      `${HENRIK_BASE}/mmr/ap/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    );
    const mmrData = await mmrRes.json();

    // Update player profile
    const updateData = {
      'riotProfile.puuid': accountData.data?.puuid,
      'riotProfile.gameName': accountData.data?.name,
      'riotProfile.tagLine': accountData.data?.tag,
      'riotProfile.currentRank': mmrData.data?.currenttierpatched || 'Unranked',
      'riotProfile.currentRankTier': mmrData.data?.currenttier || 0,
      'riotProfile.rr': mmrData.data?.ranking_in_tier || 0,
      'riotProfile.lastUpdated': new Date(),
    };

    // Also ensure they have a VALORANT gameId entry
    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const existingValId = player.gameIds?.find(g => g.game === 'VALORANT');
    if (!existingValId) {
      player.gameIds.push({
        game: 'VALORANT',
        inGameName: `${name}#${tag}`,
        riotId: `${name}#${tag}`,
      });
    } else {
      existingValId.inGameName = `${name}#${tag}`;
      existingValId.riotId = `${name}#${tag}`;
      existingValId.lastUpdatedAt = new Date();
    }

    // Apply riot profile data
    Object.assign(player.riotProfile || {}, {
      puuid: accountData.data?.puuid,
      gameName: accountData.data?.name,
      tagLine: accountData.data?.tag,
      currentRank: mmrData.data?.currenttierpatched || 'Unranked',
      currentRankTier: mmrData.data?.currenttier || 0,
      rr: mmrData.data?.ranking_in_tier || 0,
      lastUpdated: new Date(),
    });
    player.markModified('riotProfile');
    player.markModified('gameIds');

    await player.save();

    res.json({
      message: 'Riot ID linked successfully',
      riotProfile: player.riotProfile,
    });
  } catch (error) {
    console.error('Riot link error:', error.message);
    res.status(500).json({ error: 'Failed to link Riot ID', details: error.message });
  }
});

/**
 * POST /api/riot/refresh
 * Refresh cached Riot profile data for the current user
 */
router.post('/refresh', auth, async (req, res) => {
  try {
    const player = await Player.findById(req.user.id).select('riotProfile');
    if (!player?.riotProfile?.gameName || !player?.riotProfile?.tagLine) {
      return res.status(400).json({ error: 'No Riot ID linked to this account' });
    }

    // Rate limit: don't refresh more than once every 5 minutes
    const lastUpdate = player.riotProfile.lastUpdated;
    if (lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < 5 * 60 * 1000) {
      return res.status(429).json({
        error: 'Profile was recently refreshed. Try again in a few minutes.',
        riotProfile: player.riotProfile,
      });
    }

    const { gameName, tagLine } = player.riotProfile;

    const mmrRes = await fetch(
      `${HENRIK_BASE}/mmr/ap/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    const mmrData = await mmrRes.json();

    player.riotProfile.currentRank = mmrData.data?.currenttierpatched || 'Unranked';
    player.riotProfile.currentRankTier = mmrData.data?.currenttier || 0;
    player.riotProfile.rr = mmrData.data?.ranking_in_tier || 0;
    player.riotProfile.lastUpdated = new Date();
    player.markModified('riotProfile');

    await player.save();

    res.json({
      message: 'Riot profile refreshed',
      riotProfile: player.riotProfile,
    });
  } catch (error) {
    console.error('Riot refresh error:', error.message);
    res.status(500).json({ error: 'Failed to refresh Riot profile' });
  }
});

export default router;
