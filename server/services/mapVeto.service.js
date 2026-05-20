/**
 * Map Veto Service — State Machine
 *
 * Lifecycle:
 *   1. At T-30min before scheduledStartTime → veto window opens (status: 'window_open')
 *      Both teams notified via push notification.
 *   2. Any team member from EACH team joins → emits mapVeto:ready
 *      When both teams have at least one member present → veto auto-starts (status: 'in_progress')
 *   3. Ban/pick/decider turns alternate between teams (30s timer each)
 *      Timeout → auto-random map selected for that team
 *   4. All steps resolved → status: 'completed', maps locked to match
 *
 * Any registered team member can participate in the veto (not just captain).
 */

import { getGameConfig } from '../config/gameRegistry.js';
import { persistVetoSession, deleteVetoSession } from '../utils/mapVetoStore.js';

// Active veto sessions: matchId → VetoSession
const activeSessions = new Map();

function toStoredSession(session) {
  if (!session) return null;
  const { actionTimer, ...rest } = session;
  return {
    ...rest,
    readyTeams: rest.readyTeams instanceof Set ? [...rest.readyTeams] : rest.readyTeams,
    presentMembers: rest.presentMembers
      ? Object.fromEntries(
        Object.entries(rest.presentMembers).map(([tid, set]) => [
          tid,
          set instanceof Set ? [...set] : set,
        ])
      )
      : {},
  };
}

function setActiveSession(matchId, session) {
  setActiveSession(matchId, session);
  persistVetoSession(matchId, toStoredSession(session)).catch(() => {});
}

// Scheduled window timers: matchId → NodeJS.Timeout
// These fire at T-30min to open the veto window
const windowTimers = new Map();

class MapVetoService {
  // ─── Window Scheduling ──────────────────────────────────────────────────────

  /**
   * Schedule the veto window to open at T-30min before the match.
   * Called when org sets or updates a match's scheduledStartTime.
   *
   * @param {string} matchId
   * @param {Date} scheduledStartTime
   * @param {Object} params — same params as createSession (teamIds, bestOf, etc.)
   * @param {Object} io — socket.io instance for broadcasting
   * @param {Function} notifyFn — async fn(teamIds[], title, body, data) for push notifications
   */
  scheduleVetoWindow(matchId, scheduledStartTime, params, io, notifyFn) {
    // Clear any existing schedule for this match
    this.cancelWindowTimer(matchId);

    const WINDOW_MS = 30 * 60 * 1000; // 30 minutes
    const msUntilWindow = new Date(scheduledStartTime).getTime() - Date.now() - WINDOW_MS;

    if (msUntilWindow <= 0) {
      // Already within 30 minutes — open window immediately
      this._openVetoWindow(matchId, params, io, notifyFn);
      return;
    }

    const timer = setTimeout(() => {
      this._openVetoWindow(matchId, params, io, notifyFn);
      windowTimers.delete(matchId);
    }, msUntilWindow);

    windowTimers.set(matchId, timer);
  }

  /**
   * Cancel a scheduled window timer (e.g., match time changed or match cancelled).
   */
  cancelWindowTimer(matchId) {
    if (windowTimers.has(matchId)) {
      clearTimeout(windowTimers.get(matchId));
      windowTimers.delete(matchId);
    }
  }

  /**
   * Open the veto window — notifies teams and creates a 'window_open' session.
   * Veto does NOT start yet — both teams must signal readiness first.
   */
  _openVetoWindow(matchId, params, io, notifyFn) {
    const { teamAId, teamBId, teamAName, teamBName, bestOf, mapPool, teamMemberIds = {} } = params;

    const config = getGameConfig('VALORANT');
    const vetoConfig = config.mapVeto;
    const sequence = vetoConfig.sequences[bestOf] || vetoConfig.sequences[1];
    const pool = mapPool || [...config.maps];

    const session = {
      matchId,
      teamAId,
      teamBId,
      teamAName,
      teamBName,
      bestOf,
      mapPool: [...pool],
      remainingMaps: [...pool],
      sequence,
      currentStep: 0,
      history: [],
      pickedMaps: [],
      bannedMaps: [],
      // Both teams must be 'ready' before veto starts
      status: 'window_open',
      readyTeams: new Set(),        // set of teamIds that have joined
      presentMembers: {             // teamId → Set of userIds currently in the room
        [teamAId]: new Set(),
        [teamBId]: new Set(),
      },
      currentTeam: teamAId,         // will be set when veto starts (coin-flip done then)
      stepDeadline: null,
      actionTimer: null,
      createdAt: new Date(),
      windowOpenAt: new Date(),
    };

    setActiveSession(matchId, session);

    // Broadcast window open to anyone watching the match room
    if (io) {
      io.to(`match:${matchId}`).emit('mapVeto:window_open', {
        matchId,
        teamA: { id: teamAId, name: teamAName },
        teamB: { id: teamBId, name: teamBName },
        bestOf,
        mapPool: pool,
        message: 'Map veto window is now open. Join to start.',
      });
    }

    // Push notifications to all team members
    if (notifyFn) {
      const allMemberIds = [
        ...(teamMemberIds[teamAId] || []),
        ...(teamMemberIds[teamBId] || []),
      ];
      notifyFn(
        allMemberIds,
        '🗺️ Map Veto Opens Now',
        `Join the match room to start the map veto for your match against ${teamAName} / ${teamBName}.`,
        { type: 'veto_window_open', matchId }
      );
    }
  }

  // ─── Team Ready / Start Veto ────────────────────────────────────────────────

  /**
   * Signal that a player has joined the veto room for their team.
   * When both teams have at least one member → auto-start veto.
   *
   * @param {string} matchId
   * @param {string} teamId — the team this player belongs to
   * @param {string} userId — the player's userId
   * @param {Object} io — socket.io for broadcasting
   * @returns {{ status: string, readyTeams: string[], bothReady: boolean }}
   */
  teamMemberJoined(matchId, teamId, userId, io) {
    const session = activeSessions.get(matchId);
    if (!session) return { error: 'No veto session for this match' };

    // If veto already started, just track presence
    if (session.status === 'in_progress') {
      session.presentMembers[teamId]?.add(userId);
      return { status: 'in_progress', readyTeams: [...session.readyTeams], bothReady: true };
    }

    if (session.status !== 'window_open') {
      return { error: `Veto is ${session.status}` };
    }

    // Track this member as present
    if (!session.presentMembers[teamId]) {
      session.presentMembers[teamId] = new Set();
    }
    session.presentMembers[teamId].add(userId);

    // Mark team as ready
    session.readyTeams.add(teamId);

    const readyTeams = [...session.readyTeams];
    const bothReady = session.readyTeams.has(session.teamAId) && session.readyTeams.has(session.teamBId);

    if (io) {
      io.to(`match:${matchId}`).emit('mapVeto:team_ready', {
        matchId,
        teamId,
        readyTeams,
        bothReady,
      });
    }

    // Both teams present — auto-start the veto
    if (bothReady) {
      this._startVeto(matchId, io);
    }

    setActiveSession(matchId, session);
    return { status: session.status, readyTeams, bothReady };
  }

  /**
   * Track when a player leaves the veto room.
   */
  teamMemberLeft(matchId, teamId, userId) {
    const session = activeSessions.get(matchId);
    if (!session) return;
    session.presentMembers[teamId]?.delete(userId);
    setActiveSession(matchId, session);
  }

  /**
   * Start the actual veto — called automatically when both teams are ready.
   */
  _startVeto(matchId, io) {
    const session = activeSessions.get(matchId);
    if (!session || session.status !== 'window_open') return;

    const config = getGameConfig('VALORANT');
    const vetoConfig = config.mapVeto;

    // Coin flip: randomly determine first pick
    session.currentTeam = Math.random() < 0.5 ? session.teamAId : session.teamBId;
    session.status = 'in_progress';
    session.stepDeadline = new Date(Date.now() + (vetoConfig.timerSeconds * 1000));

    setActiveSession(matchId, session);

    if (io) {
      io.to(`match:${matchId}`).emit('mapVeto:started', {
        ...this.getState(matchId),
        message: `Both teams ready. ${session.currentTeam === session.teamAId ? session.teamAName : session.teamBName} goes first.`,
      });
    }

    // Start the step timer
    this._scheduleStepTimer(matchId, io);
  }

  // ─── Veto Actions ──────────────────────────────────────────────────────────

  /**
   * Process a ban/pick action from a team.
   *
   * @param {string} matchId
   * @param {string} teamId — the team performing the action
   * @param {string} mapName — the map being banned/picked
   * @param {Object} [io]
   * @returns {{ success: boolean, state: Object, error?: string }}
   */
  processAction(matchId, teamId, mapName, io) {
    const session = activeSessions.get(matchId);
    if (!session) return { success: false, error: 'No active veto session' };
    if (session.status !== 'in_progress') return { success: false, error: `Veto is ${session.status}` };
    if (session.currentTeam !== teamId) return { success: false, error: 'Not your turn' };
    if (!session.remainingMaps.includes(mapName)) return { success: false, error: `Map '${mapName}' is not available` };

    // Cancel the step auto-random timer
    this._clearActionTimer(session);

    const actionType = session.sequence[session.currentStep];
    session.remainingMaps = session.remainingMaps.filter(m => m !== mapName);

    session.history.push({
      type: actionType,
      team: teamId,
      map: mapName,
      step: session.currentStep,
      timestamp: new Date(),
    });

    if (actionType === 'ban') {
      session.bannedMaps.push(mapName);
    } else {
      session.pickedMaps.push(mapName);
    }

    session.currentStep++;
    setActiveSession(matchId, session);

    // Check completion
    const completed = this._checkCompletion(matchId);
    if (completed) {
      return { success: true, state: this.getState(matchId) };
    }

    // Alternate team turn
    session.currentTeam = session.currentTeam === session.teamAId ? session.teamBId : session.teamAId;

    const config = getGameConfig('VALORANT');
    session.stepDeadline = new Date(Date.now() + (config.mapVeto.timerSeconds * 1000));

    setActiveSession(matchId, session);
    this._scheduleStepTimer(matchId, io);

    return { success: true, state: this.getState(matchId) };
  }

  /**
   * Auto-random: system picks for the current team after timeout.
   */
  autoRandom(matchId, io) {
    const session = activeSessions.get(matchId);
    if (!session || session.status !== 'in_progress') return null;

    const randomMap = session.remainingMaps[Math.floor(Math.random() * session.remainingMaps.length)];
    const result = this.processAction(matchId, session.currentTeam, randomMap, io);

    if (io && result.success) {
      io.to(`match:${matchId}`).emit('mapVeto:auto_random', {
        map: randomMap,
        teamId: session.currentTeam,
        reason: 'timeout',
        state: result.state,
      });
    }

    return result;
  }

  // ─── Completion & Decider ─────────────────────────────────────────────────

  _checkCompletion(matchId) {
    const session = activeSessions.get(matchId);
    if (!session) return false;

    const atEnd = session.currentStep >= session.sequence.length;
    const deciderNext =
      session.currentStep < session.sequence.length &&
      session.sequence[session.currentStep] === 'decider' &&
      session.remainingMaps.length === 1;

    if (atEnd || deciderNext) {
      // Pick decider if remaining
      if (session.remainingMaps.length === 1) {
        session.pickedMaps.push(session.remainingMaps[0]);
        session.history.push({
          type: 'decider',
          team: 'system',
          map: session.remainingMaps[0],
          step: session.currentStep,
          timestamp: new Date(),
        });
        session.remainingMaps = [];
        session.currentStep++;
      }

      session.status = 'completed';
      this._clearActionTimer(session);
      setActiveSession(matchId, session);
      return true;
    }

    return false;
  }

  // ─── Step Timer ───────────────────────────────────────────────────────────

  _scheduleStepTimer(matchId, io) {
    const session = activeSessions.get(matchId);
    if (!session) return;

    this._clearActionTimer(session);

    const config = getGameConfig('VALORANT');
    const delayMs = (config.mapVeto.timerSeconds + 1) * 1000; // +1s grace

    session.actionTimer = setTimeout(() => {
      this.autoRandom(matchId, io);
    }, delayMs);

    setActiveSession(matchId, session);
  }

  _clearActionTimer(session) {
    if (session.actionTimer) {
      clearTimeout(session.actionTimer);
      session.actionTimer = null;
    }
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  getState(matchId) {
    const session = activeSessions.get(matchId);
    if (!session) return null;

    return {
      matchId: session.matchId,
      teamA: { id: session.teamAId, name: session.teamAName },
      teamB: { id: session.teamBId, name: session.teamBName },
      bestOf: session.bestOf,
      mapPool: session.mapPool,
      remainingMaps: session.remainingMaps,
      currentStep: session.currentStep,
      totalSteps: session.sequence.length,
      currentAction: session.sequence[session.currentStep] || null,
      currentTeam: session.currentTeam,
      readyTeams: [...(session.readyTeams || new Set())],
      history: session.history,
      pickedMaps: session.pickedMaps,
      bannedMaps: session.bannedMaps,
      status: session.status,
      stepDeadline: session.stepDeadline,
      windowOpenAt: session.windowOpenAt,
      createdAt: session.createdAt,
    };
  }

  cancelSession(matchId) {
    const session = activeSessions.get(matchId);
    if (session) {
      this._clearActionTimer(session);
      session.status = 'cancelled';
      setActiveSession(matchId, session);
    }
    this.cancelWindowTimer(matchId);
    return this.getState(matchId);
  }

  deleteSession(matchId) {
    const session = activeSessions.get(matchId);
    if (session) this._clearActionTimer(session);
    this.cancelWindowTimer(matchId);
    activeSessions.delete(matchId);
    deleteVetoSession(matchId).catch(() => {});
  }

  hasSession(matchId) {
    return activeSessions.has(matchId);
  }

  getSessionStatus(matchId) {
    return activeSessions.get(matchId)?.status || null;
  }
}

const mapVetoService = new MapVetoService();
export default mapVetoService;
