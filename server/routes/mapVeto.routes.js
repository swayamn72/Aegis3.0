/**
 * Map Veto Routes
 *
 * REST endpoints for managing map veto sessions.
 * WebSocket events provide real-time updates, but these serve as fallback/management.
 *
 * Authorization:
 *   - Start/Cancel/Reset: Org admin (verifyOrgToken)
 *   - Action/State: Any team member in the match
 */

import express from 'express';
import mapVetoService from '../services/mapVeto.service.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import { verifyToken } from '../middleware/auth.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';

const router = express.Router();

// ─── Helper: Check if player is on one of the match teams ─────────────────────
async function getPlayerTeamInMatch(playerId, match) {
  if (!match.vsResults?.teamA || !match.vsResults?.teamB) return null;

  const teamAId = (match.vsResults.teamA._id || match.vsResults.teamA).toString();
  const teamBId = (match.vsResults.teamB._id || match.vsResults.teamB).toString();

  // Check registrations for this tournament
  const reg = await Registration.findOne({
    tournament: match.tournament._id || match.tournament,
    'roster.player': playerId,
  }).select('team').lean();

  if (!reg) return null;
  const teamId = reg.team.toString();

  if (teamId === teamAId) return teamAId;
  if (teamId === teamBId) return teamBId;
  return null;
}

// ─── POST /api/map-veto/:matchId/start ────────────────────────────────────────
// ORG OVERRIDE: Manually open the veto window early (normally auto-triggers at T-30min)
router.post('/:matchId/start', verifyOrgToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { mapPool, bestOf: reqBestOf } = req.body;

    const match = await Match.findById(matchId)
      .populate('vsResults.teamA', 'teamName')
      .populate('vsResults.teamB', 'teamName')
      .populate('tournament', 'gameTitle gameSettings')
      .lean();

    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.gameTitle !== 'VALORANT') {
      return res.status(400).json({ error: 'Map veto is only available for Valorant matches' });
    }
    if (!match.vsResults?.teamA || !match.vsResults?.teamB) {
      return res.status(400).json({ error: 'Match must have both teams assigned before starting veto' });
    }
    if (mapVetoService.hasSession(matchId)) {
      return res.status(409).json({ error: 'Veto session already exists. Use GET /:matchId/state to check status.' });
    }

    const bestOf = reqBestOf || match.metadata?.bestOf || 1;
    const teamAId = match.vsResults.teamA._id.toString();
    const teamBId = match.vsResults.teamB._id.toString();

    // Trigger window open now (override — skip the T-30min timer)
    mapVetoService.scheduleVetoWindow(
      matchId,
      new Date(), // pass current time so msUntilWindow is negative → opens immediately
      {
        teamAId,
        teamBId,
        teamAName: match.vsResults.teamA.teamName,
        teamBName: match.vsResults.teamB.teamName,
        bestOf,
        mapPool,
      },
      req.app.get('io'),
      null // no push notifications for org override
    );

    res.json({ message: 'Veto window opened. Waiting for both teams to join.', state: mapVetoService.getState(matchId) });
  } catch (error) {
    console.error('Error starting map veto:', error);
    res.status(500).json({ error: 'Failed to start map veto' });
  }
});


// ─── GET /api/map-veto/:matchId/state ─────────────────────────────────────────
// Get current veto state (polling fallback)
router.get('/:matchId/state', async (req, res) => {
  const state = mapVetoService.getState(req.params.matchId);
  if (!state) {
    return res.status(404).json({ error: 'No active veto session for this match' });
  }
  res.json(state);
});

// ─── POST /api/map-veto/:matchId/action ───────────────────────────────────────
// Team member submits a ban/pick action (REST fallback for WebSocket)
router.post('/:matchId/action', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { map: mapName } = req.body;
    const playerId = req.user.id;

    if (!mapName) {
      return res.status(400).json({ error: 'map is required' });
    }

    const match = await Match.findById(matchId)
      .populate('vsResults.teamA', 'teamName')
      .populate('vsResults.teamB', 'teamName')
      .populate('tournament', 'gameTitle')
      .lean();

    if (!match) return res.status(404).json({ error: 'Match not found' });

    // Verify player is on one of the teams
    const teamId = await getPlayerTeamInMatch(playerId, match);
    if (!teamId) {
      return res.status(403).json({ error: 'You are not on a team in this match' });
    }

    const result = mapVetoService.processAction(matchId, teamId, mapName);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Broadcast via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`match:${matchId}`).emit('mapVeto:updated', result.state);
      if (result.state.status === 'completed') {
        io.to(`match:${matchId}`).emit('mapVeto:completed', result.state);
      }
    }

    res.json(result.state);
  } catch (error) {
    console.error('Error processing veto action:', error);
    res.status(500).json({ error: 'Failed to process veto action' });
  }
});

// ─── DELETE /api/map-veto/:matchId ────────────────────────────────────────────
// Org admin cancels/resets the veto
router.delete('/:matchId', verifyOrgToken, async (req, res) => {
  const state = mapVetoService.cancelSession(req.params.matchId);
  if (!state) {
    return res.status(404).json({ error: 'No active veto session' });
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`match:${req.params.matchId}`).emit('mapVeto:cancelled', state);
  }

  mapVetoService.deleteSession(req.params.matchId);
  res.json({ message: 'Veto session cancelled', lastState: state });
});

export default router;
