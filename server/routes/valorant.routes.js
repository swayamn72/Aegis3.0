/**
 * Valorant API Routes
 *
 * Proxy/cache layer for valorant-api.com to provide:
 *   - Agent data with images (displayIcon, bustPortrait, killfeedPortrait)
 *   - Map data with splash images
 *   - Phase suggestions for tournament creation
 *
 * Caches in memory with 5-minute TTL to avoid hammering the external API.
 */

import express from 'express';
import { getGameConfig } from '../config/gameRegistry.js';

const router = express.Router();

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = {};

async function fetchWithCache(key, url) {
  const now = Date.now();
  if (cache[key] && (now - cache[key].timestamp) < CACHE_TTL_MS) {
    return cache[key].data;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`valorant-api.com returned ${response.status}`);
  }

  const json = await response.json();
  cache[key] = { data: json.data, timestamp: now };
  return json.data;
}

// ─── GET /api/valorant/agents ─────────────────────────────────────────────────
// Returns all playable agents with image URLs and role info
router.get('/agents', async (req, res) => {
  try {
    const config = getGameConfig('VALORANT');
    const agents = await fetchWithCache('agents', config.agentImageApi);

    // Transform to a cleaner format
    const result = agents.map(agent => ({
      uuid: agent.uuid,
      name: agent.displayName,
      description: agent.description,
      role: agent.role?.displayName || 'Unknown',
      roleIcon: agent.role?.displayIcon || null,
      images: {
        icon: agent.displayIcon,
        bust: agent.bustPortrait,
        full: agent.fullPortrait,
        killfeed: agent.killfeedPortrait,
        background: agent.background,
      },
      backgroundColors: agent.backgroundGradientColors || [],
    }));

    res.json({ agents: result, count: result.length });
  } catch (error) {
    console.error('Error fetching agents:', error.message);
    res.status(502).json({ error: 'Failed to fetch agent data from valorant-api.com' });
  }
});

// ─── GET /api/valorant/agents/:name ───────────────────────────────────────────
// Single agent lookup by display name (case-insensitive)
router.get('/agents/:name', async (req, res) => {
  try {
    const config = getGameConfig('VALORANT');
    const agents = await fetchWithCache('agents', config.agentImageApi);

    const name = req.params.name.toLowerCase();
    const agent = agents.find(a => a.displayName.toLowerCase() === name);

    if (!agent) {
      return res.status(404).json({ error: `Agent '${req.params.name}' not found` });
    }

    res.json({
      uuid: agent.uuid,
      name: agent.displayName,
      description: agent.description,
      role: agent.role?.displayName || 'Unknown',
      roleIcon: agent.role?.displayIcon || null,
      images: {
        icon: agent.displayIcon,
        bust: agent.bustPortrait,
        full: agent.fullPortrait,
        killfeed: agent.killfeedPortrait,
        background: agent.background,
      },
      backgroundColors: agent.backgroundGradientColors || [],
      abilities: (agent.abilities || []).map(a => ({
        slot: a.slot,
        name: a.displayName,
        description: a.description,
        icon: a.displayIcon,
      })),
    });
  } catch (error) {
    console.error('Error fetching agent:', error.message);
    res.status(502).json({ error: 'Failed to fetch agent data' });
  }
});

// ─── GET /api/valorant/maps ───────────────────────────────────────────────────
// Returns all maps with splash images and minimap URLs
router.get('/maps', async (req, res) => {
  try {
    const config = getGameConfig('VALORANT');
    const maps = await fetchWithCache('maps', config.mapImageApi);

    // Filter to only playable maps (exclude "The Range" etc.)
    const playableMaps = config.maps;
    const result = maps
      .filter(m => playableMaps.includes(m.displayName))
      .map(m => ({
        uuid: m.uuid,
        name: m.displayName,
        coordinates: m.coordinates,
        images: {
          splash: m.splash,
          minimap: m.displayIcon,
          listIcon: m.listViewIcon,
          listIconTall: m.listViewIconTall,
        },
      }));

    res.json({ maps: result, count: result.length });
  } catch (error) {
    console.error('Error fetching maps:', error.message);
    res.status(502).json({ error: 'Failed to fetch map data from valorant-api.com' });
  }
});

// ─── GET /api/valorant/phase-suggestions ──────────────────────────────────────
// Returns VCT-style phase structure suggestions based on slot count
router.get('/phase-suggestions', (req, res) => {
  const slots = parseInt(req.query.slots, 10);
  if (!slots || slots < 2) {
    return res.status(400).json({ error: 'slots query parameter is required (min 2)' });
  }

  const config = getGameConfig('VALORANT');
  const presets = config.phaseSuggestions || {};

  // Find the closest preset (round down to nearest preset key)
  const presetKeys = Object.keys(presets).map(Number).sort((a, b) => a - b);
  let bestKey = presetKeys[0];
  for (const key of presetKeys) {
    if (slots >= key) bestKey = key;
  }

  const suggestion = presets[bestKey] || [];

  // If slots don't match preset exactly, add a warning
  const warnings = [];
  if (!presets[slots]) {
    warnings.push(`No exact preset for ${slots} slots. Using ${bestKey}-slot template. You may need to adjust phases.`);
  }

  // Check if slots is a power of 2 (ideal for brackets)
  const isPowerOf2 = (slots & (slots - 1)) === 0;
  if (!isPowerOf2 && !suggestion.some(p => p.format === 'Swiss')) {
    warnings.push(`${slots} teams is not a power of 2. Consider using Swiss format to handle uneven brackets.`);
  }

  res.json({
    slots,
    phases: suggestion,
    warnings,
    vetoConfig: config.mapVeto,
    mapPool: config.maps,
  });
});

// ─── GET /api/valorant/veto-config ────────────────────────────────────────────
// Returns map veto sequence config for a given bestOf
router.get('/veto-config', (req, res) => {
  const bestOf = parseInt(req.query.bestOf, 10) || 1;
  const config = getGameConfig('VALORANT');
  const vetoConfig = config.mapVeto;

  if (!vetoConfig?.sequences?.[bestOf]) {
    return res.status(400).json({
      error: `No veto sequence for Best of ${bestOf}`,
      available: Object.keys(vetoConfig?.sequences || {}),
    });
  }

  res.json({
    bestOf,
    sequence: vetoConfig.sequences[bestOf],
    timerSeconds: vetoConfig.timerSeconds,
    mapPool: config.maps,
  });
});

export default router;
