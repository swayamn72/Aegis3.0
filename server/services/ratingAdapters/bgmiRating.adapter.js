/**
 * BGMI Rating Adapter
 *
 * Extracts BR-specific rating logic for use by the main aegisRating.js orchestrator.
 * This handles the Battle Royale scoring model:
 *   - 25-team lobbies with placement positions
 *   - Placement Points (PP) table
 *   - Kill-based individual performance scoring
 *   - MPS = 0.30 * PlacementScore + 0.70 * KillScore
 */

// ─── BR Placement Points Table ───────────────────────────────────────────────
export const PP_TABLE = {
  1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 2, 8: 1,
  9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
  16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0, 25: 0,
};

/**
 * Calculate Match Performance Score (MPS) for a BR player.
 *
 * @param {number} finalPosition - Team's final placement (1-25)
 * @param {number} playerKills   - Individual player kills
 * @param {number} avgKillsPerTeam - Average kills across all teams in the match
 * @returns {{ mps: number, ps: number, ks: number }}
 */
export function calculateMPS(finalPosition, playerKills, avgKillsPerTeam) {
  const ppValue = PP_TABLE[finalPosition] ?? 0;
  const ps = ppValue / 10;  // Placement Score: normalized 0–1

  const ks = Math.min(playerKills / Math.max(1, avgKillsPerTeam), 3.0) / 3.0;  // Kill Score: normalized 0–1

  const mps = 0.30 * ps + 0.70 * ks;

  return { mps, ps, ks };
}

/**
 * Extract all playing players from BR match results.
 *
 * @param {Array} results - Match.results array
 * @returns {string[]} Array of player ID strings
 */
export function extractPlayerIds(results) {
  const ids = [];
  for (const teamResult of results) {
    for (const entry of (teamResult.kills?.breakdown || [])) {
      if (entry.isPlaying === false) continue;
      if (entry.player) ids.push(entry.player);
    }
  }
  return ids;
}

/**
 * Compute field average rating for a BR match.
 *
 * @param {Array} results  - Match results
 * @param {Map} playerMap  - Map of player ID → player document
 * @param {Map} regByTeam  - Map of team ID → registration
 * @param {Function} getSeedRating - Function to get seed rating
 * @param {object} tournamentDoc
 * @returns {{ avgFieldRating: number, fieldPlayerCount: number }}
 */
export function computeFieldAverage(results, playerMap, regByTeam, getSeedRating, tournamentDoc) {
  let fieldRatingSum = 0;
  let fieldPlayerCount = 0;

  for (const teamResult of results) {
    const reg = regByTeam.get((teamResult.team?._id || teamResult.team)?.toString());
    for (const entry of (teamResult.kills?.breakdown || [])) {
      if (entry.isPlaying === false) continue;
      const pid = entry.player?.toString();
      if (!pid) continue;
      const player = playerMap.get(pid);
      if (!player) continue;

      let effectiveRating = player.aegisRating;
      if (player.aegisMatchesRated < 5 && reg?.isDirectInvite) {
        const seed = reg.seedRating ?? getSeedRating(reg.seedPhase, tournamentDoc);
        if (seed > effectiveRating) effectiveRating = seed;
      }
      fieldRatingSum += effectiveRating;
      fieldPlayerCount++;
    }
  }

  return {
    avgFieldRating: fieldPlayerCount > 0 ? fieldRatingSum / fieldPlayerCount : 1000,
    fieldPlayerCount,
  };
}

/**
 * Iterate over BR results and yield per-player scoring data.
 *
 * @param {Array} results - Match results
 * @param {Map} regByTeam - Registration map
 * @returns {Generator<{teamResult, entry, reg, finalPosition}>}
 */
export function* iteratePlayerResults(results, regByTeam) {
  for (const teamResult of results) {
    const finalPosition = teamResult.finalPosition;
    if (!finalPosition) continue;

    const reg = regByTeam.get((teamResult.team?._id || teamResult.team)?.toString());

    for (const entry of (teamResult.kills?.breakdown || [])) {
      if (entry.isPlaying === false) continue;
      const pid = entry.player?.toString();
      if (!pid) continue;

      yield { teamResult, entry, reg, finalPosition, pid, playerKills: entry.kills || 0 };
    }
  }
}
