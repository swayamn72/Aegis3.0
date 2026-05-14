/**
 * Standings Calculator — Game-Aware
 *
 * Centralized module for computing tournament standings from match data.
 * Used by: phase advancement, tournament conclusion, PointsTable UI (via API).
 *
 * Supports:
 *   - Battle Royale (BGMI): placement points + kill points
 *   - Head-to-Head (Valorant): W/L record, round differential, Buchholz
 */

import { getGameConfig, isHeadToHead, isBattleRoyale } from '../config/gameRegistry.js';

// ─── Valorant (Head-to-Head) Standings ────────────────────────────────────────

/**
 * Calculate Valorant standings from completed matches.
 *
 * @param {Array} matches — Match documents with vsResults populated
 * @param {Object} [options]
 * @param {boolean} [options.includeBuchholz=false] — Compute Buchholz tiebreaker
 * @returns {Array<{
 *   teamId: string, teamName: string,
 *   wins: number, losses: number, matchesPlayed: number,
 *   roundsWon: number, roundsLost: number, roundDiff: number,
 *   points: number, buchholz: number,
 *   opponents: string[], mapRecord: Object
 * }>}
 */
export function calculateValorantStandings(matches, options = {}) {
  const { includeBuchholz = false } = options;
  const teamMap = {}; // teamId → stats

  const completedMatches = matches.filter(m => m.status === 'completed' && m.vsResults);

  for (const match of completedMatches) {
    const vs = match.vsResults;
    if (!vs.teamA || !vs.teamB) continue;

    const teamAId = (vs.teamA._id || vs.teamA).toString();
    const teamBId = (vs.teamB._id || vs.teamB).toString();
    const scoreA = vs.scoreA || 0;
    const scoreB = vs.scoreB || 0;
    const winnerId = vs.winner ? (vs.winner._id || vs.winner).toString() : null;

    // Initialize team entries
    for (const [teamId, teamRef] of [[teamAId, vs.teamA], [teamBId, vs.teamB]]) {
      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          teamId,
          teamName: teamRef.teamName || teamRef.toString(),
          teamLogo: teamRef.logo || null,
          wins: 0,
          losses: 0,
          matchesPlayed: 0,
          roundsWon: 0,
          roundsLost: 0,
          roundDiff: 0,
          points: 0,
          buchholz: 0,
          opponents: [],       // for Buchholz calculation
          mapRecord: {},       // map → { wins, losses }
        };
      }
    }

    const entryA = teamMap[teamAId];
    const entryB = teamMap[teamBId];

    // Update match stats
    entryA.matchesPlayed++;
    entryB.matchesPlayed++;
    entryA.roundsWon += scoreA;
    entryA.roundsLost += scoreB;
    entryB.roundsWon += scoreB;
    entryB.roundsLost += scoreA;
    entryA.opponents.push(teamBId);
    entryB.opponents.push(teamAId);

    if (winnerId === teamAId) {
      entryA.wins++;
      entryB.losses++;
    } else if (winnerId === teamBId) {
      entryB.wins++;
      entryA.losses++;
    }

    // Map-level record (for Bo3/Bo5 with mapResults)
    if (vs.mapResults && Array.isArray(vs.mapResults)) {
      for (const mr of vs.mapResults) {
        const mapName = mr.map || 'Unknown';
        const mrWinner = mr.winner ? (mr.winner._id || mr.winner).toString() : null;

        for (const [teamId, isWinner] of [[teamAId, mrWinner === teamAId], [teamBId, mrWinner === teamBId]]) {
          if (!teamMap[teamId].mapRecord[mapName]) {
            teamMap[teamId].mapRecord[mapName] = { wins: 0, losses: 0 };
          }
          if (isWinner) teamMap[teamId].mapRecord[mapName].wins++;
          else teamMap[teamId].mapRecord[mapName].losses++;
        }
      }
    }
  }

  // Calculate derived stats
  const gameConfig = getGameConfig('VALORANT');
  const winPts = gameConfig?.scoring?.winPoints ?? 3;
  const lossPts = gameConfig?.scoring?.lossPoints ?? 0;

  for (const entry of Object.values(teamMap)) {
    entry.roundDiff = entry.roundsWon - entry.roundsLost;
    entry.points = (entry.wins * winPts) + (entry.losses * lossPts);
  }

  // Buchholz tiebreaker: sum of each opponent's wins
  if (includeBuchholz) {
    for (const entry of Object.values(teamMap)) {
      entry.buchholz = entry.opponents.reduce((sum, oppId) => {
        return sum + (teamMap[oppId]?.wins || 0);
      }, 0);
    }
  }

  // Sort: points desc → wins desc → roundDiff desc → roundsWon desc → buchholz desc
  return Object.values(teamMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
    if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
    return b.buchholz - a.buchholz;
  });
}

// ─── Swiss-Specific Utilities ─────────────────────────────────────────────────

/**
 * Get the Swiss W-L group label for a team (e.g., "2-1", "3-0").
 */
export function getSwissRecord(entry) {
  return `${entry.wins}-${entry.losses}`;
}

/**
 * Group teams by their Swiss W-L record.
 * @param {Array} standings — Output from calculateValorantStandings
 * @returns {Object} e.g., { '2-0': [...teams], '1-1': [...teams], '0-2': [...teams] }
 */
export function groupBySwissRecord(standings) {
  const groups = {};
  for (const entry of standings) {
    const record = getSwissRecord(entry);
    if (!groups[record]) groups[record] = [];
    groups[record].push(entry);
  }
  return groups;
}

/**
 * Generate Swiss round matchups for the next round.
 * Pairs teams with the same W-L record; uses Buchholz for seeding within groups.
 * Avoids rematches where possible.
 *
 * @param {Array} standings — Current standings with opponents history
 * @param {Object} [options]
 * @param {boolean} [options.avoidRematches=true]
 * @returns {Array<{ teamA: string, teamB: string }>} — Matchup pairs (teamId)
 */
export function generateSwissMatchups(standings, options = {}) {
  const { avoidRematches = true } = options;
  const groups = groupBySwissRecord(standings);
  const matchups = [];
  const paired = new Set();

  // Sort group keys by "closeness to middle" — pair 2-0 with 2-0, 1-1 with 1-1, etc.
  const sortedRecords = Object.keys(groups).sort((a, b) => {
    const [aw, al] = a.split('-').map(Number);
    const [bw, bl] = b.split('-').map(Number);
    // Sort by total matches played (ascending), then by wins (descending)
    const totalA = aw + al, totalB = bw + bl;
    if (totalA !== totalB) return totalA - totalB;
    return bw - aw;
  });

  // Flatten into ordered list: within each group, sort by Buchholz desc for seeding
  const ordered = [];
  for (const record of sortedRecords) {
    const group = groups[record].sort((a, b) => b.buchholz - a.buchholz);
    ordered.push(...group);
  }

  // Pair sequentially within same-record groups first, then across groups
  for (const record of sortedRecords) {
    const group = groups[record]
      .filter(t => !paired.has(t.teamId))
      .sort((a, b) => b.buchholz - a.buchholz);

    for (let i = 0; i < group.length; i++) {
      if (paired.has(group[i].teamId)) continue;

      let bestPartner = null;
      for (let j = i + 1; j < group.length; j++) {
        if (paired.has(group[j].teamId)) continue;

        // Avoid rematches if possible
        if (avoidRematches && group[i].opponents.includes(group[j].teamId)) continue;

        bestPartner = group[j];
        break;
      }

      // If no partner found without rematch, accept rematch
      if (!bestPartner) {
        for (let j = i + 1; j < group.length; j++) {
          if (paired.has(group[j].teamId)) continue;
          bestPartner = group[j];
          break;
        }
      }

      if (bestPartner) {
        matchups.push({ teamA: group[i].teamId, teamB: bestPartner.teamId });
        paired.add(group[i].teamId);
        paired.add(bestPartner.teamId);
      }
    }
  }

  // Handle stragglers across groups (odd numbers in a group)
  const unpaired = ordered.filter(t => !paired.has(t.teamId));
  for (let i = 0; i < unpaired.length - 1; i += 2) {
    matchups.push({ teamA: unpaired[i].teamId, teamB: unpaired[i + 1].teamId });
    paired.add(unpaired[i].teamId);
    paired.add(unpaired[i + 1].teamId);
  }

  return matchups;
}

/**
 * Determine which teams have advanced or been eliminated in Swiss.
 * @param {Array} standings
 * @param {number} [winsToAdvance=3]
 * @param {number} [lossesToEliminate=3]
 * @returns {{ advanced: string[], eliminated: string[], active: string[] }}
 */
export function getSwissStatus(standings, winsToAdvance = 3, lossesToEliminate = 3) {
  const advanced = [];
  const eliminated = [];
  const active = [];

  for (const entry of standings) {
    if (entry.wins >= winsToAdvance) {
      advanced.push(entry.teamId);
    } else if (entry.losses >= lossesToEliminate) {
      eliminated.push(entry.teamId);
    } else {
      active.push(entry.teamId);
    }
  }

  return { advanced, eliminated, active };
}

// ─── Battle Royale (BGMI) Standings ───────────────────────────────────────────

/**
 * Calculate BGMI standings from completed matches.
 * Aggregates placement points + kill points across all matches in a phase.
 *
 * @param {Array} matches — Match documents with results populated
 * @returns {Array<{ teamId, teamName, totalPoints, positionPoints, killPoints, kills, chickenDinners, matchesPlayed }>}
 */
export function calculateBRStandings(matches) {
  const teamMap = {};
  const gameConfig = getGameConfig('BGMI');
  const posPoints = gameConfig?.scoring?.positionPoints || {};
  const killPtVal = gameConfig?.scoring?.killPointValue || 1;

  const completedMatches = matches.filter(m => m.status === 'completed' && m.results?.length > 0);

  for (const match of completedMatches) {
    for (const result of match.results) {
      const teamId = (result.team?._id || result.team).toString();

      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          teamId,
          teamName: result.teamName || result.team?.teamName || teamId,
          totalPoints: 0,
          positionPoints: 0,
          killPoints: 0,
          kills: 0,
          chickenDinners: 0,
          matchesPlayed: 0,
        };
      }

      const entry = teamMap[teamId];
      const pos = result.position || 99;
      const kills = result.kills || 0;
      const ppPts = posPoints[pos] || 0;
      const kpPts = kills * killPtVal;

      entry.matchesPlayed++;
      entry.kills += kills;
      entry.positionPoints += ppPts;
      entry.killPoints += kpPts;
      entry.totalPoints += ppPts + kpPts;
      if (pos === 1) entry.chickenDinners++;
    }
  }

  return Object.values(teamMap).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.chickenDinners !== a.chickenDinners) return b.chickenDinners - a.chickenDinners;
    return b.kills - a.kills;
  });
}

// ─── Universal Entry Point ────────────────────────────────────────────────────

/**
 * Calculate standings for any game title.
 * @param {string} gameTitle — 'BGMI' or 'VALORANT'
 * @param {Array} matches — Match documents
 * @param {Object} [options]
 * @returns {Array} — Game-appropriate standings array
 */
export function calculateStandings(gameTitle, matches, options = {}) {
  if (isHeadToHead(gameTitle)) {
    return calculateValorantStandings(matches, options);
  }
  if (isBattleRoyale(gameTitle)) {
    return calculateBRStandings(matches);
  }
  throw new Error(`Unsupported game title for standings: ${gameTitle}`);
}

export default {
  calculateStandings,
  calculateValorantStandings,
  calculateBRStandings,
  generateSwissMatchups,
  getSwissStatus,
  groupBySwissRecord,
  getSwissRecord,
};
