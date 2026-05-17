/**
 * teamHelpers.js
 *
 * Centralised helpers for the multi-game team system.
 * A player can belong to at most ONE team per game.
 * player.teams is a Map<gameKey, ObjectId>   (e.g. { BGMI: <id>, VALORANT: <id> })
 *
 * MAX ROSTER SIZES (authoritative — sourced from gameRegistry):
 *   BGMI      → 5 players
 *   VALORANT  → 6 players
 */

import { GAME_REGISTRY } from '../config/gameRegistry.js';

// ── Roster size helpers ────────────────────────────────────────────────────

/**
 * Returns the maximum number of players allowed on a team for the given game.
 * Falls back to 5 if game is unknown.
 *
 * @param {string} game  – e.g. 'BGMI' | 'VALORANT'
 * @returns {number}
 */
export function getMaxPlayers(game) {
  return GAME_REGISTRY[game]?.maxRosterSize ?? 5;
}

/**
 * Returns true when the team's players array is at or above the game limit.
 *
 * @param {object} team  – Mongoose Team doc or plain object (needs .players + .primaryGame)
 * @returns {boolean}
 */
export function isTeamFull(team) {
  const max = getMaxPlayers(team.primaryGame);
  return (team.players?.length ?? 0) >= max;
}

// ── Per-game team lookup helpers ───────────────────────────────────────────

/**
 * Returns the Team ObjectId a player is in for a specific game, or null.
 * Works with both the new `teams` Map field and the legacy `team` ObjectId.
 *
 * @param {object} player  – Mongoose Player doc (may have .teams Map or .team ObjectId)
 * @param {string} game    – 'BGMI' | 'VALORANT'
 * @returns {import('mongoose').Types.ObjectId | null}
 */
export function getPlayerTeamForGame(player, game) {
  // New schema: Map<game, ObjectId>
  if (player.teams instanceof Map) {
    return player.teams.get(game) ?? null;
  }
  // Mongo stores Maps as plain objects when using .lean()
  if (player.teams && typeof player.teams === 'object') {
    return player.teams[game] ?? null;
  }
  return null;
}

/**
 * Returns true if the player already has a team for the given game.
 *
 * @param {object} player
 * @param {string} game
 * @returns {boolean}
 */
export function hasTeamForGame(player, game) {
  return getPlayerTeamForGame(player, game) != null;
}

/**
 * Returns true if the player has at least one team (any game).
 *
 * @param {object} player
 * @returns {boolean}
 */
export function hasAnyTeam(player) {
  if (player.teams instanceof Map) return player.teams.size > 0;
  if (player.teams && typeof player.teams === 'object') {
    return Object.keys(player.teams).length > 0;
  }
  return false;
}

// ── Mongo update helpers ───────────────────────────────────────────────────

/**
 * Builds a $set update that adds a team to the player's teams map for a game.
 *
 * @param {string} game    – 'BGMI' | 'VALORANT'
 * @param {*}      teamId  – ObjectId
 * @returns {object}  Mongo $set fragment
 */
export function setTeamForGame(game, teamId) {
  return { [`teams.${game}`]: teamId };
}

/**
 * Builds a $unset update that removes a team from the player's teams map.
 *
 * @param {string} game
 * @returns {object}  Mongo $unset fragment
 */
export function unsetTeamForGame(game) {
  return { [`teams.${game}`]: '' };
}

/**
 * Given a player document (after removing a team for `game`),
 * determine whether teamStatus should be updated.
 * - If teams map is now empty → 'looking for a team'
 * - Otherwise → keep 'in a team'
 *
 * @param {object} player   – Player doc AFTER the removal (or plain object)
 * @param {string} removedGame
 * @returns {string}
 */
export function resolveTeamStatusAfterRemoval(player, removedGame) {
  const teamsMap =
    player.teams instanceof Map
      ? Object.fromEntries(player.teams)
      : (player.teams ?? {});

  // Clone and remove the game we're about to remove
  const remaining = { ...teamsMap };
  delete remaining[removedGame];

  return Object.keys(remaining).length === 0
    ? 'looking for a team'
    : 'in a team';
}
