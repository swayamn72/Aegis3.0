/**
 * Valorant Rating Adapter
 *
 * Implements Elo-style 1v1 team rating with ACS-weighted individual deltas.
 * Calibrated to the same scale as BGMI (top players ≈ same rating).
 *
 * IMPORTANT: `aegisRating` is the PLATFORM-WIDE headline rating.
 * It equals max(BGMI rating, Valorant rating, ...).
 * After updating `valRating`, we promote it to `aegisRating` if it's higher.
 * BGMI writes directly to `aegisRating` (no change needed there).
 *
 * Key differences from BGMI:
 *   - Only 2 teams per match (head-to-head)
 *   - Win/loss is the primary signal (not placement in 25-team field)
 *   - Individual performance measured by ACS contribution relative to team average
 *   - Round differential matters (13-0 stomp vs 13-11 close game)
 */

import Player from '../../models/player.model.js';
import Team from '../../models/team.model.js';
import RatingEvent from '../../models/ratingEvent.model.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const TIER_K = { S: 48, A: 40, B: 34, C: 28, Community: 24 };
const TIER_BASE = { S: 1.00, A: 0.75, B: 0.55, C: 0.35, Community: 0.20 };

const MATCH_GAIN_CAP = { S: 65, A: 50, B: 40, C: 32, Community: 25 };
const MATCH_LOSS_CAP = { S: 40, A: 34, B: 28, C: 24, Community: 20 };
const TOURNAMENT_GAIN_CAP = { S: 220, A: 170, B: 130, C: 95, Community: 70 };
const TOURNAMENT_LOSS_CAP = { S: 130, A: 110, B: 90, C: 75, Community: 55 };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute round differential factor.
 * A 13-0 stomp gets a higher factor than a 13-11 close match.
 * Range: 0.7 (close) to 1.3 (stomp)
 */
function roundDiffFactor(winnerRounds, loserRounds) {
  const totalRounds = winnerRounds + loserRounds;
  if (totalRounds === 0) return 1.0;
  const diff = (winnerRounds - loserRounds) / totalRounds;
  return 0.7 + 0.6 * diff;  // 0.7 to 1.3
}

/**
 * Compute individual ACS weight.
 * Players with higher ACS get a larger share of the team's rating change.
 * Returns a multiplier centered around 1.0.
 */
function acsWeight(playerAcs, teamAvgAcs) {
  if (!teamAvgAcs || teamAvgAcs === 0) return 1.0;
  const ratio = playerAcs / teamAvgAcs;
  // Clamp between 0.6 and 1.5 to prevent extreme swings
  return clamp(ratio, 0.6, 1.5);
}

// ─── Main Rating Calculator ─────────────────────────────────────────────────

/**
 * Calculate rating deltas for all players in a Valorant match.
 *
 * @param {object} matchDoc      - Match document with vsResults populated
 * @param {object} tournamentDoc - Tournament document
 * @param {Map}    cumulativeDeltas - Shared cumulative tracker for tournament caps
 * @param {Function} getPhaseMultiplier - Phase multiplier function
 * @returns {Promise<Array>} Rating events created
 */
export async function calculateValorantRatingDelta(matchDoc, tournamentDoc, cumulativeDeltas, getPhaseMultiplier) {
  const matchId = matchDoc._id;

  // Idempotency
  const existing = await RatingEvent.countDocuments({ match: matchId });
  if (existing > 0) {
    console.log(`⏭️  Valorant match ${matchId} already rated, skipping.`);
    return [];
  }

  const vs = matchDoc.vsResults;
  if (!vs || !vs.teamA || !vs.teamB) return [];

  const tier = tournamentDoc.tier || 'Community';
  const importanceScore = tournamentDoc.importanceScore ?? 50;
  const phaseMultiplier = getPhaseMultiplier(matchDoc.tournamentPhase, tournamentDoc);
  const TW = TIER_BASE[tier] * (importanceScore / 100) * phaseMultiplier;

  const winnerId = vs.winner?.toString();
  const teamAId = (vs.teamA._id || vs.teamA).toString();
  const teamBId = (vs.teamB._id || vs.teamB).toString();

  // Determine win/loss
  const teamAWon = winnerId === teamAId;
  const teamBWon = winnerId === teamBId;
  const isDraw = !teamAWon && !teamBWon;  // Shouldn't happen in Valorant but handle

  // Round differential
  const rdFactor = roundDiffFactor(
    teamAWon ? vs.scoreA : vs.scoreB,
    teamAWon ? vs.scoreB : vs.scoreA
  );

  // Collect all player IDs
  const playerStats = vs.playerStats || [];
  if (playerStats.length === 0) return [];

  const allPlayerIds = playerStats.map(ps => ps.player).filter(Boolean);
  const players = await Player.find({ _id: { $in: allPlayerIds } })
    .select('aegisRating aegisRatingPeak valRating valRatingPeak valRatingFloor valPrestigeFloor valMatchesRated valIsProvisional')
    .lean();
  const playerMap = new Map(players.map(p => [p._id.toString(), p]));

  // Compute team average ratings
  const teamAPlayers = playerStats.filter(ps => (ps.team?._id || ps.team)?.toString() === teamAId);
  const teamBPlayers = playerStats.filter(ps => (ps.team?._id || ps.team)?.toString() === teamBId);

  const teamARating = teamAPlayers.reduce((sum, ps) => {
    const p = playerMap.get(ps.player?.toString());
    return sum + (p?.valRating || 1000);
  }, 0) / (teamAPlayers.length || 1);

  const teamBRating = teamBPlayers.reduce((sum, ps) => {
    const p = playerMap.get(ps.player?.toString());
    return sum + (p?.valRating || 1000);
  }, 0) / (teamBPlayers.length || 1);

  // Team average ACS
  const teamAAvgAcs = teamAPlayers.reduce((sum, ps) => sum + (ps.acs || 0), 0) / (teamAPlayers.length || 1);
  const teamBAvgAcs = teamBPlayers.reduce((sum, ps) => sum + (ps.acs || 0), 0) / (teamBPlayers.length || 1);

  // --- Caps ---
  const phaseCapFactor = 0.80 + (0.20 * phaseMultiplier);
  const importanceFactor = 0.70 + (0.30 * (importanceScore / 100));
  const capScale = phaseCapFactor * importanceFactor;

  const maxGainPerMatch = Math.round((MATCH_GAIN_CAP[tier] || 25) * capScale);
  const maxLossPerMatch = Math.round((MATCH_LOSS_CAP[tier] || 20) * capScale);
  const maxTournGain = Math.round((TOURNAMENT_GAIN_CAP[tier] || 70) * capScale);
  const maxTournLoss = Math.round((TOURNAMENT_LOSS_CAP[tier] || 55) * capScale);

  const playerOps = [];
  const ratingEvents = [];

  // Process each player
  for (const ps of playerStats) {
    const pid = ps.player?.toString();
    if (!pid) continue;
    const player = playerMap.get(pid);
    if (!player) continue;

    const isTeamA = (ps.team?._id || ps.team)?.toString() === teamAId;
    const myTeamRating = isTeamA ? teamARating : teamBRating;
    const oppTeamRating = isTeamA ? teamBRating : teamARating;
    const myTeamAvgAcs = isTeamA ? teamAAvgAcs : teamBAvgAcs;
    const playerWon = isTeamA ? teamAWon : teamBWon;

    // Elo expected score
    const expectedScore = 1 / (1 + Math.pow(10, (oppTeamRating - myTeamRating) / 400));
    const actualScore = playerWon ? 1.0 : (isDraw ? 0.5 : 0.0);

    // K-factor with provisional boost
    const KExp = (player.valMatchesRated || 0) < 20 ? 1.5 : 1.0;
    const KRating = player.valRating >= 3200 ? 0.82 : player.valRating >= 2500 ? 0.92 : 1.0;
    const K = (TIER_K[tier] || 24) * KExp * KRating;

    // Base delta from Elo
    let delta = K * TW * (actualScore - expectedScore);

    // Apply round differential factor (bigger wins = bigger gains)
    delta *= rdFactor;

    // Apply ACS weight (better individual performance = bigger share)
    const acsW = acsWeight(ps.acs || 0, myTeamAvgAcs);
    delta *= acsW;

    let cappedReason = null;

    // Per-match cap
    if (delta > maxGainPerMatch) { delta = maxGainPerMatch; cappedReason = 'match_cap'; }
    else if (delta < -maxLossPerMatch) { delta = -maxLossPerMatch; cappedReason = 'match_cap'; }

    // Per-tournament cumulative cap
    if (cumulativeDeltas) {
      const cumSoFar = cumulativeDeltas.get(pid) || 0;
      if (delta > 0 && cumSoFar + delta > maxTournGain) { delta = 0; cappedReason = 'tournament_cap'; }
      else if (delta < 0 && cumSoFar + delta < -maxTournLoss) { delta = 0; cappedReason = 'tournament_cap'; }
      cumulativeDeltas.set(pid, (cumSoFar || 0) + delta);
    }

    // Floor guard
    const effectiveFloor = Math.max(player.valPrestigeFloor || 0, (player.valRatingPeak || 0) * 0.80);
    let newRating = Math.round(player.valRating + delta);
    if (newRating < effectiveFloor) newRating = effectiveFloor;
    const actualDelta = newRating - player.valRating;

    const newPeak = Math.max(player.valRatingPeak || 0, newRating);
    const newFloor = Math.max(player.valPrestigeFloor || 0, newPeak * 0.80);
    const newMatchesRated = (player.valMatchesRated || 0) + 1;

    playerOps.push({
      updateOne: {
        filter: { _id: player._id },
        update: {
          $set: {
            valRating: newRating,
            valRatingFloor: Math.round(newFloor),
            valMatchesRated: newMatchesRated,
            valIsProvisional: newMatchesRated < 20,
            valLastRatedMatchAt: new Date(),
          },
          // Promote to platform aegisRating if valRating is now higher
          // aegisRating = max(all game ratings)
          $max: {
            valRatingPeak: newPeak,
            aegisRating: newRating,
            aegisRatingPeak: newRating,
          },
        },
      },
    });

    ratingEvents.push({
      player: player._id,
      match: matchId,
      tournament: tournamentDoc._id,
      delta: actualDelta,
      ratingBefore: player.valRating,
      ratingAfter: newRating,
      mps: Math.round(acsW * 1000) / 1000,   // Store ACS weight as 'mps' for consistency
      tw: Math.round(TW * 1000) / 1000,
      k: Math.round(K * 100) / 100,
      tier,
      importanceScore,
      phaseMultiplier,
      cappedReason,
      ratingSource: 'normal',
      date: matchDoc.scheduledStartTime || new Date(),
    });

    // Update in-memory for subsequent matches
    player.valRating = newRating;
    player.valRatingPeak = newPeak;
    player.valRatingFloor = Math.round(newFloor);
    player.valMatchesRated = newMatchesRated;
    player.valIsProvisional = newMatchesRated < 20;
  }

  // Execute writes
  if (playerOps.length > 0) await Player.bulkWrite(playerOps);
  if (ratingEvents.length > 0) {
    try {
      await RatingEvent.insertMany(ratingEvents, { ordered: false });
    } catch (err) {
      if (err.code === 11000) {
        console.warn(`⚠️ Some Valorant rating events for match ${matchId} already existed.`);
      } else {
        throw err;
      }
    }
  }

  // Update team ratings
  for (const teamId of [teamAId, teamBId]) {
    try {
      const team = await Team.findById(teamId).populate('players', 'valRating');
      if (team?.players?.length) {
        team.valRating = Math.round(
          team.players.reduce((sum, p) => sum + (p.valRating || 1000), 0) / team.players.length
        );
        await team.save();
      }
    } catch (err) {
      console.warn(`⚠️ Failed to update Valorant team ${teamId} rating:`, err.message);
    }
  }

  console.log(`✅ Valorant Rating: ${ratingEvents.length} player ratings updated for match ${matchId}`);
  return ratingEvents;
}
