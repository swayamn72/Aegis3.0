/**
 * Veto Window Scheduler
 *
 * Runs a polling cron every minute. For every Valorant match that:
 *   - Is 'scheduled' (not yet started)
 *   - Has not yet had a veto window opened
 *   - Is within 31 minutes of starting
 *
 * It calls mapVetoService.scheduleVetoWindow() which fires the actual
 * window open at exactly T-30min (or immediately if already in window).
 *
 * This is intentionally simple polling rather than a one-shot setTimeout
 * at server start — so it survives server restarts for upcoming matches.
 */

import cron from 'node-cron';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import notificationService from './notification.service.js';
import mapVetoService from './mapVeto.service.js';
import logger from '../config/logger.js';

// Track which matchIds we've already scheduled to avoid double-scheduling
const scheduledMatchIds = new Set();

/**
 * Initialize the veto window scheduler.
 * Call this at server start, passing the socket.io instance.
 *
 * @param {Object} io — socket.io server instance
 */
export function startVetoWindowScheduler(io) {
  // Run every minute
  cron.schedule('* * * * *', () => {
    checkUpcomingVetoWindows(io).catch(err => {
      logger.error('veto_window_scheduler_error', { error: err.message });
    });
  });

  logger.info('veto_window_scheduler_started');
}

async function checkUpcomingVetoWindows(io) {
  const now = new Date();
  const WINDOW_LEAD_MS = 31 * 60 * 1000; // check matches starting within 31 min

  // Find upcoming Valorant matches not yet in veto
  const upcomingMatches = await Match.find({
    gameTitle: 'VALORANT',
    status: 'scheduled',
    scheduledStartTime: {
      $gte: now,
      $lte: new Date(now.getTime() + WINDOW_LEAD_MS),
    },
  })
    .populate('vsResults.teamA', 'teamName')
    .populate('vsResults.teamB', 'teamName')
    .populate('tournament', 'gameSettings')
    .lean();

  for (const match of upcomingMatches) {
    const matchId = match._id.toString();

    // Skip if already scheduled or already has a veto session
    if (scheduledMatchIds.has(matchId)) continue;
    if (mapVetoService.hasSession(matchId)) continue;

    // Skip if teams aren't assigned yet
    if (!match.vsResults?.teamA || !match.vsResults?.teamB) continue;

    scheduledMatchIds.add(matchId);

    const teamAId = match.vsResults.teamA._id.toString();
    const teamBId = match.vsResults.teamB._id.toString();
    const teamAName = match.vsResults.teamA.teamName;
    const teamBName = match.vsResults.teamB.teamName;
    const bestOf = match.metadata?.bestOf || match.tournament?.gameSettings?.defaultBestOf || 1;

    // Get all player member IDs for both teams (for notifications)
    const teamMemberIds = await getTeamMemberIds(match.tournament._id || match.tournament, [teamAId, teamBId]);

    logger.info('veto_window_scheduling', { matchId, teamAName, teamBName, scheduledStartTime: match.scheduledStartTime });

    // Define notification function
    const notifyFn = async (playerIds, title, body, data) => {
      if (!playerIds || playerIds.length === 0) return;
      notificationService.sendToMultiplePlayers(playerIds, title, body, data).catch(err => {
        logger.error('veto_notification_error', { matchId, error: err.message });
      });
    };

    mapVetoService.scheduleVetoWindow(
      matchId,
      match.scheduledStartTime,
      { teamAId, teamBId, teamAName, teamBName, bestOf, teamMemberIds },
      io,
      notifyFn
    );
  }

  // Clean up scheduledMatchIds for matches that are done (completed/cancelled)
  // Runs when set grows large to prevent unbounded growth
  if (scheduledMatchIds.size > 200) {
    const idArray = [...scheduledMatchIds];
    try {
      const doneMatches = await Match.find({
        _id: { $in: idArray },
        status: { $in: ['completed', 'cancelled'] },
      }).select('_id').lean();
      doneMatches.forEach(m => scheduledMatchIds.delete(m._id.toString()));
    } catch (cleanupErr) {
      logger.error('veto_scheduler_cleanup_error', { error: cleanupErr.message });
    }
  }
}

async function getTeamMemberIds(tournamentId, teamIds) {
  const result = {};
  try {
    const registrations = await Registration.find({
      tournament: tournamentId,
      team: { $in: teamIds },
      status: { $in: ['approved', 'checked_in'] },
    })
      .select('team roster.player')
      .lean();

    for (const reg of registrations) {
      const teamId = reg.team.toString();
      if (!result[teamId]) result[teamId] = [];
      const playerIds = (reg.roster || []).map(r => r.player?.toString()).filter(Boolean);
      result[teamId].push(...playerIds);
    }
  } catch (err) {
    logger.error('veto_get_team_members_error', { error: err.message });
  }
  return result;
}
