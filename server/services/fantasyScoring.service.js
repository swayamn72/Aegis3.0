import Match from '../models/match.model.js';
import FantasyContest from '../models/fantasyContest.model.js';
import FantasySquad from '../models/fantasySquad.model.js';
import FantasyPlayerPool from '../models/fantasyPlayerPool.model.js';
import { supportsFantasy } from '../config/gameRegistry.js';

/**
 * Calculate fantasy points for a single player in a single match.
 */
function calculatePlayerMatchPoints(playerKills, teamPosition, scoring) {
  let pts = 0;
  pts += playerKills * (scoring.killPoints || 1);
  if (playerKills >= 3) pts += scoring.threeKillBonus || 1;
  if (playerKills >= 5) pts += scoring.fiveKillBonus || 2;
  if (playerKills === 0) pts += scoring.zeroKillPenalty || -1;
  if (teamPosition === 1) pts += scoring.chickenDinner || 5;
  else if (teamPosition <= 3) pts += scoring.topThree || 3;
  else if (teamPosition <= 5) pts += scoring.topFive || 2;
  else if (teamPosition <= 8) pts += scoring.topEight || 1;
  return pts;
}

/**
 * Score all squads in a contest for a specific match.
 */
export async function scoreMatchForContest(contestId, matchId) {
  const contest = await FantasyContest.findById(contestId);
  if (!contest) throw new Error('Contest not found');

  const match = await Match.findById(matchId);
  if (!match || match.status !== 'completed') throw new Error('Match not completed');

  const scoring = contest.scoringSystem || {};

  // Build lookup: playerId -> { kills, teamPosition }
  const playerPerf = new Map();
  for (const teamResult of (match.results || [])) {
    const pos = teamResult.finalPosition || 25;
    for (const entry of (teamResult.kills?.breakdown || [])) {
      if (!entry.player || entry.isPlaying === false) continue;
      playerPerf.set(entry.player.toString(), { kills: entry.kills || 0, position: pos });
    }
  }

  // Score all squads
  const squads = await FantasySquad.find({ contest: contestId });
  const bulkOps = [];

  for (const squad of squads) {
    let matchTotalPts = 0;
    for (const sp of squad.players) {
      const perf = playerPerf.get(sp.player.toString());
      if (!perf) continue;

      let pts = calculatePlayerMatchPoints(perf.kills, perf.position, scoring);
      if (sp.role === 'captain') pts *= scoring.captainMultiplier || 2;
      else if (sp.role === 'vice_captain') pts *= scoring.viceCaptainMultiplier || 1.5;
      pts = Math.round(pts * 10) / 10;

      // Add match points entry
      const existing = sp.matchPoints.find(mp => mp.match?.toString() === matchId.toString());
      if (existing) existing.points = pts;
      else sp.matchPoints.push({ match: matchId, points: pts });

      sp.pointsEarned = sp.matchPoints.reduce((sum, mp) => sum + mp.points, 0);
      matchTotalPts += pts;
    }
    squad.totalPoints = squad.players.reduce((sum, p) => sum + p.pointsEarned, 0);
    squad.status = 'scored';
    bulkOps.push({ updateOne: { filter: { _id: squad._id }, update: { $set: { players: squad.players, totalPoints: squad.totalPoints, status: 'scored' } } } });
  }

  if (bulkOps.length > 0) await FantasySquad.bulkWrite(bulkOps);

  // Recalculate ranks
  const ranked = await FantasySquad.find({ contest: contestId }).sort({ totalPoints: -1 });
  const rankOps = ranked.map((s, i) => ({ updateOne: { filter: { _id: s._id }, update: { $set: { rank: i + 1 } } } }));
  if (rankOps.length > 0) await FantasySquad.bulkWrite(rankOps);

  // Update selection percentages
  const totalSquads = squads.length || 1;
  const selectionCounts = new Map();
  for (const squad of squads) {
    for (const sp of squad.players) {
      const pid = sp.player.toString();
      selectionCounts.set(pid, (selectionCounts.get(pid) || 0) + 1);
    }
  }
  const poolOps = [];
  for (const [pid, count] of selectionCounts) {
    poolOps.push({ updateOne: { filter: { contest: contestId, player: pid }, update: { $set: { selectionCount: count, selectionPercentage: Math.round((count / totalSquads) * 100) } } } });
  }
  if (poolOps.length > 0) await FantasyPlayerPool.bulkWrite(poolOps);

  console.log(`✅ Fantasy scoring complete for contest ${contestId}, match ${matchId}: ${squads.length} squads scored`);
  return { scoredSquads: squads.length };
}

/**
 * Score all matches in a contest.
 */
export async function scoreEntireContest(contestId) {
  const contest = await FantasyContest.findById(contestId);
  if (!contest) throw new Error('Contest not found');

  let totalScored = 0;
  for (const matchId of contest.matches) {
    const match = await Match.findById(matchId);
    if (match?.status === 'completed') {
      const result = await scoreMatchForContest(contestId, matchId);
      totalScored += result.scoredSquads;
    }
  }

  contest.status = 'completed';
  await contest.save();
  return { totalScored, matchesProcessed: contest.matches.length };
}
