import Player from '../models/player.model.js';
import Match from '../models/match.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import RatingEvent from '../models/ratingEvent.model.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const PP_TABLE = {
  1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 2, 8: 1,
  9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
  16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0, 25: 0,
};

const TIER_BASE = { S: 1.00, A: 0.75, B: 0.55, C: 0.35, Community: 0.20 };

const K_TIER = { S: 40, A: 35, B: 30, C: 25, Community: 20 };

const PEAK_WEIGHT = { S: 1.00, A: 0.90, B: 0.75, C: 0.55, Community: 0.00 };

const TIER_BASE_RATING = { S: 3000, A: 2200, B: 1600, C: 1200, Community: 1000 };

// Codeforces-like volatility tuning by tournament tier.
const K_TIER_CF = { S: 56, A: 48, B: 42, C: 36, Community: 30 };
const VOLATILITY_TIER = { S: 1.45, A: 1.25, B: 1.10, C: 1.00, Community: 0.90 };
const TOURNAMENT_GAIN_CAP_BASE = { S: 240, A: 180, B: 135, C: 100, Community: 75 };
const TOURNAMENT_LOSS_CAP_BASE = { S: 140, A: 120, B: 100, C: 80, Community: 60 };
const MATCH_GAIN_CAP_BASE = { S: 70, A: 55, B: 45, C: 35, Community: 28 };
const MATCH_LOSS_CAP_BASE = { S: 45, A: 38, B: 32, C: 26, Community: 22 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// ============================================================================
// HELPER — Phase Multiplier (structural position)
// ============================================================================

export function getPhaseMultiplier(tournamentPhase, tournamentDoc) {
  const phases = tournamentDoc?.phases || [];
  const totalPhases = phases.length;
  if (totalPhases === 0) return 1.00;

  const phaseIndex = phases.findIndex(
    p => p.name?.toLowerCase() === tournamentPhase?.toLowerCase()
  );
  if (phaseIndex === -1) return 1.00;

  const phasePosition = totalPhases === 1
    ? 1.0
    : phaseIndex / (totalPhases - 1);

  // 0.85 (first phase) → 1.30 (last phase)
  return Math.round((0.85 + 0.45 * phasePosition) * 100) / 100;
}

// ============================================================================
// HELPER — Seed Rating (dynamic from tournament structure)
// ============================================================================

export function getSeedRating(seedPhase, tournamentDoc) {
  if (!seedPhase || !tournamentDoc) return 1000;

  const tierBase = TIER_BASE_RATING[tournamentDoc.tier] ?? 1000;
  const importance = (tournamentDoc.importanceScore ?? 50) / 100;

  const phases = tournamentDoc.phases || [];
  const totalPhases = phases.length;
  const phaseIndex = phases.findIndex(
    p => p.name?.toLowerCase() === seedPhase.toLowerCase()
  );

  const phasePosition = totalPhases <= 1
    ? 1.0
    : phaseIndex === -1
      ? 0.5
      : phaseIndex / (totalPhases - 1);

  return Math.round(1000 + (tierBase - 1000) * importance * phasePosition);
}

// ============================================================================
// CORE — Calculate Aegis Rating Delta (per match)
// ============================================================================

export async function calculateAegisRatingDelta(matchDoc, tournamentDoc, cumulativeDeltas) {
  const matchId = matchDoc._id;

  // --- Idempotency check ---
  const existingCount = await RatingEvent.countDocuments({ match: matchId });
  if (existingCount > 0) {
    console.log(`⏭️  Match ${matchId} already has ${existingCount} rating events, skipping.`);
    return [];
  }

  const tier = tournamentDoc.tier || 'Community';
  const importanceScore = tournamentDoc.importanceScore ?? 50;
  const results = matchDoc.results || [];
  if (results.length === 0) return [];

  // --- Collect all player IDs from kill breakdowns (only players who actually played) ---
  const allPlayerIds = [];
  for (const teamResult of results) {
    for (const entry of (teamResult.kills?.breakdown || [])) {
      // Skip players who are marked as not playing this match
      if (entry.isPlaying === false) continue;
      if (entry.player) allPlayerIds.push(entry.player);
    }
  }
  if (allPlayerIds.length === 0) return [];

  // --- Load all player documents ---
  const players = await Player.find({ _id: { $in: allPlayerIds } })
    .select('aegisRating aegisRatingPeak aegisRatingFloor aegisPrestigeFloor aegisMatchesRated aegisIsProvisional')
    .lean();
  const playerMap = new Map(players.map(p => [p._id.toString(), p]));

  // --- Load registrations for seed checking ---
  const teams = results.map(r => r.team?._id || r.team).filter(Boolean);
  const registrations = await Registration.find({
    tournament: tournamentDoc._id,
    team: { $in: teams },
  }).select('team isDirectInvite seedPhase seedRating').lean();

  const regByTeam = new Map(registrations.map(r => [r.team?.toString(), r]));

  // --- Compute field average rating ---
  const teamsCount = results.length;
  const matchTotalKills = results.reduce((sum, r) => sum + (r.kills?.total || 0), 0);
  const phaseMultiplier = getPhaseMultiplier(matchDoc.tournamentPhase, tournamentDoc);
  const TW = TIER_BASE[tier] * (importanceScore / 100) * phaseMultiplier;

  // Compute avg field rating using effective ratings
  let fieldRatingSum = 0;
  let fieldPlayerCount = 0;
  for (const teamResult of results) {
    const reg = regByTeam.get((teamResult.team?._id || teamResult.team)?.toString());
    for (const entry of (teamResult.kills?.breakdown || [])) {
      if (entry.isPlaying === false) continue; // skip non-playing roster members
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
  const avgFieldRating = fieldPlayerCount > 0 ? fieldRatingSum / fieldPlayerCount : 1000;

  // --- Tier + importance scaled caps (phase-aware, supports ~+250 exceptional S-tier runs) ---
  const phaseCapFactor = 0.80 + (0.20 * phaseMultiplier);
  const importanceFactor = 0.70 + (0.30 * (importanceScore / 100));
  const capScale = phaseCapFactor * importanceFactor;

  const maxGainPerMatch = Math.round((MATCH_GAIN_CAP_BASE[tier] || 28) * capScale);
  const maxLossPerMatch = Math.round((MATCH_LOSS_CAP_BASE[tier] || 22) * capScale);
  const maxTournGain = Math.round((TOURNAMENT_GAIN_CAP_BASE[tier] || 75) * capScale);
  const maxTournLoss = Math.round((TOURNAMENT_LOSS_CAP_BASE[tier] || 60) * capScale);

  // --- Compute deltas ---
  const playerOps = [];      // bulkWrite ops for Player
  const ratingEvents = [];   // docs for RatingEvent.insertMany

  for (const teamResult of results) {
    const finalPosition = teamResult.finalPosition;
    if (!finalPosition) continue;

    const ppValue = PP_TABLE[finalPosition] ?? 0;
    const PS = ppValue / 10;
    const avgKills = teamsCount > 0 ? matchTotalKills / teamsCount : 1;
    const reg = regByTeam.get((teamResult.team?._id || teamResult.team)?.toString());

    for (const entry of (teamResult.kills?.breakdown || [])) {
      // Skip players marked as not playing this match
      if (entry.isPlaying === false) continue;
      const pid = entry.player?.toString();
      if (!pid) continue;
      const player = playerMap.get(pid);
      if (!player) {
        console.warn(`⚠️ Player ${pid} not found in DB, skipping rating update`);
        continue;
      }

      const playerKills = entry.kills || 0;
      const KS = Math.min(playerKills / Math.max(1, avgKills), 3.0) / 3.0;
      const MPS = 0.30 * PS + 0.70 * KS;

      // --- Determine effective rating & K ---
      let effectiveRating = player.aegisRating;
      let ratingSource = 'normal';
      let KExp;

      if (player.aegisMatchesRated < 5 && reg?.isDirectInvite) {
        const seed = reg.seedRating ?? getSeedRating(reg.seedPhase, tournamentDoc);
        if (seed > effectiveRating) effectiveRating = seed;
        ratingSource = 'seeded';
        KExp = 1.0; // no provisional bonus for seeded
      } else {
        KExp = player.aegisMatchesRated < 20 ? 1.5 : 1.0;
      }

      const KRating = effectiveRating >= 3200 ? 0.82 : effectiveRating >= 2500 ? 0.92 : 1.0;
      const KTier = K_TIER_CF[tier] || K_TIER[tier] || 20;
      const tierVolatility = VOLATILITY_TIER[tier] || 1.0;
      const K = KTier * KExp * KRating * tierVolatility;

      // Codeforces-style expectation curve based on field vs player effective rating.
      const expectedScore = 1 / (1 + Math.pow(10, (avgFieldRating - effectiveRating) / 400));

      // Performance score with a controlled upset bonus when popping off in stronger fields.
      const performanceBoost = clamp((MPS - 0.70) * 0.50, 0, 0.20);
      const strongerFieldBoost = clamp((avgFieldRating - effectiveRating) / 1200, 0, 0.20);
      const actualScore = clamp(MPS + performanceBoost + strongerFieldBoost, 0, 1);

      let delta = K * TW * (actualScore - expectedScore);
      let cappedReason = null;

      // --- Per-match cap ---
      if (delta > maxGainPerMatch) {
        delta = maxGainPerMatch;
        cappedReason = 'match_cap';
      } else if (delta < -maxLossPerMatch) {
        delta = -maxLossPerMatch;
        cappedReason = 'match_cap';
      }

      // --- Per-tournament cumulative cap ---
      if (cumulativeDeltas) {
        const cumulativeSoFar = cumulativeDeltas.get(pid) || 0;
        if (delta > 0 && cumulativeSoFar + delta > maxTournGain) {
          delta = 0;
          cappedReason = 'tournament_cap';
        } else if (delta < 0 && cumulativeSoFar + delta < -maxTournLoss) {
          delta = 0;
          cappedReason = 'tournament_cap';
        }
        cumulativeDeltas.set(pid, cumulativeSoFar + delta);
      }

      // --- Floor guard ---
      const effectiveFloor = Math.max(player.aegisPrestigeFloor || 0, (player.aegisRatingPeak || 0) * 0.80);
      let newRating = Math.round(player.aegisRating + delta);
      if (newRating < effectiveFloor) newRating = effectiveFloor;
      const actualDelta = newRating - player.aegisRating;

      // --- Peak contribution ---
      const peakWeight = PEAK_WEIGHT[tier] || 0;
      const peakContribution = peakWeight > 0 ? Math.round(newRating * peakWeight) : 0;
      const newPeak = peakWeight > 0 ? Math.max(player.aegisRatingPeak || 0, peakContribution) : (player.aegisRatingPeak || 0);
      const newFloor = Math.max(player.aegisPrestigeFloor || 0, newPeak * 0.80);
      const newMatchesRated = (player.aegisMatchesRated || 0) + 1;

      // --- Build bulkWrite op ---
      const updateOp = {
        $set: {
          aegisRating: newRating,
          aegisRatingFloor: Math.round(newFloor),
          aegisMatchesRated: newMatchesRated,
          aegisIsProvisional: newMatchesRated < 20,
          aegisLastRatedMatchAt: new Date(),
        },
      };
      if (peakWeight > 0) {
        updateOp.$max = { aegisRatingPeak: peakContribution };
      }

      playerOps.push({
        updateOne: {
          filter: { _id: player._id },
          update: updateOp,
        },
      });

      ratingEvents.push({
        player: player._id,
        match: matchId,
        tournament: tournamentDoc._id,
        delta: actualDelta,
        ratingBefore: player.aegisRating,
        ratingAfter: newRating,
        mps: Math.round(MPS * 1000) / 1000,
        tw: Math.round(TW * 1000) / 1000,
        k: Math.round(K * 100) / 100,
        tier,
        importanceScore,
        phaseMultiplier,
        cappedReason,
        ratingSource,
        date: matchDoc.scheduledStartTime || new Date(),
      });

      // Update in-memory player for subsequent matches in batch
      player.aegisRating = newRating;
      player.aegisRatingPeak = newPeak;
      player.aegisRatingFloor = Math.round(newFloor);
      player.aegisMatchesRated = newMatchesRated;
      player.aegisIsProvisional = newMatchesRated < 20;
    }
  }

  // --- Execute writes ---
  if (playerOps.length > 0) {
    await Player.bulkWrite(playerOps);
  }
  if (ratingEvents.length > 0) {
    try {
      await RatingEvent.insertMany(ratingEvents, { ordered: false });
    } catch (err) {
      if (err.code === 11000) {
        console.warn(`⚠️ Some rating events for match ${matchId} already existed (duplicate key).`);
      } else {
        throw err;
      }
    }
  }

  console.log(`✅ Aegis Rating: ${ratingEvents.length} player ratings updated for match ${matchId}`);
  return ratingEvents;
}

// ============================================================================
// ORCHESTRATOR — Process Phase Completion (batch)
// ============================================================================

export async function processPhaseCompletion(tournamentDoc, phaseName) {
  console.log(`📊 Processing phase "${phaseName}" for tournament ${tournamentDoc._id}`);

  // Find all completed matches in this phase, chronologically
  const matches = await Match.find({
    tournament: tournamentDoc._id,
    tournamentPhase: phaseName,
    status: 'completed',
  }).sort({ scheduledStartTime: 1 });

  if (matches.length === 0) {
    console.log(`⏭️  No completed matches in phase "${phaseName}"`);
    return;
  }

  // Filter out already-processed matches (idempotency)
  const matchIds = matches.map(m => m._id);
  const existingEvents = await RatingEvent.distinct('match', { match: { $in: matchIds } });
  const existingSet = new Set(existingEvents.map(id => id.toString()));
  const unprocessed = matches.filter(m => !existingSet.has(m._id.toString()));

  if (unprocessed.length === 0) {
    console.log(`⏭️  All ${matches.length} matches in phase "${phaseName}" already processed`);
    return;
  }

  console.log(`🎯 Processing ${unprocessed.length}/${matches.length} unprocessed matches`);

  // Shared cumulative delta tracker for per-tournament caps
  const cumulativeDeltas = new Map();

  for (const match of unprocessed) {
    await calculateAegisRatingDelta(match, tournamentDoc, cumulativeDeltas);
  }

  // --- Recalculate team ratings (roster mean) ---
  const allTeamIds = [...new Set(
    matches.flatMap(m => (m.results || []).map(r => (r.team?._id || r.team)?.toString()))
  )].filter(Boolean);

  for (const teamId of allTeamIds) {
    try {
      const team = await Team.findById(teamId).populate('players', 'aegisRating');
      if (team?.players?.length) {
        team.aegisRating = Math.round(
          team.players.reduce((sum, p) => sum + (p.aegisRating || 1000), 0) / team.players.length
        );
        await team.save();
      }
    } catch (err) {
      console.warn(`⚠️ Failed to update team ${teamId} aegisRating:`, err.message);
    }
  }

  // --- Three-way prestige trigger ---
  const phase = tournamentDoc.phases?.find(p => p.name === phaseName);
  const isFinalPhase =
    phase?.type === 'final_stage'
    || (tournamentDoc.finalStandings?.length > 0)
    || (tournamentDoc.phases?.[tournamentDoc.phases.length - 1]?.name === phaseName);

  if (isFinalPhase) {
    if (phase?.type !== 'final_stage') {
      console.warn(
        `⚠️ Prestige counters triggered via fallback for phase "${phaseName}" ` +
        `in tournament ${tournamentDoc._id}. Consider setting phase.type = 'final_stage'.`
      );
    }
    await updatePrestigeCounters(tournamentDoc);
  }

  console.log(`✅ Phase "${phaseName}" processing complete`);
}

// ============================================================================
// REVERSE — Undo rating events for a match
// ============================================================================

export async function reverseMatchRating(matchId) {
  const events = await RatingEvent.find({ match: matchId }).lean();
  if (events.length === 0) return 0;

  const ops = events.map(event => ({
    updateOne: {
      filter: { _id: event.player },
      update: {
        $inc: {
          aegisRating: -event.delta,
          aegisMatchesRated: -1,
        },
      },
    },
  }));

  await Player.bulkWrite(ops);

  // Fix floor/provisional for affected players
  const playerIds = events.map(e => e.player);
  const players = await Player.find({ _id: { $in: playerIds } })
    .select('aegisRating aegisRatingPeak aegisPrestigeFloor aegisMatchesRated');
  for (const p of players) {
    const floor = Math.max(p.aegisPrestigeFloor || 0, (p.aegisRatingPeak || 0) * 0.80);
    if (p.aegisRating < floor) p.aegisRating = Math.round(floor);
    p.aegisRatingFloor = Math.round(floor);
    p.aegisIsProvisional = (p.aegisMatchesRated || 0) < 20;
    await p.save();
  }

  await RatingEvent.deleteMany({ match: matchId });
  console.log(`🔄 Reversed ${events.length} rating events for match ${matchId}`);
  return events.length;
}

// ============================================================================
// REVERSE — Undo all rating events for a tournament phase
// ============================================================================

export async function reversePhaseRating(tournamentId, phaseName) {
  const matches = await Match.find({
    tournament: tournamentId,
    tournamentPhase: phaseName,
  }).select('_id');

  let total = 0;
  for (const match of matches) {
    total += await reverseMatchRating(match._id);
  }
  console.log(`🔄 Reversed ${total} total rating events for phase "${phaseName}"`);
  return total;
}

// ============================================================================
// DECAY — Weekly inactivity decay
// ============================================================================

export async function applyDecay() {
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);

  const players = await Player.find({
    aegisLastRatedMatchAt: { $lt: eightWeeksAgo, $ne: null },
    $expr: { $gt: ['$aegisRating', '$aegisPrestigeFloor'] },
  }).select('aegisRating aegisRatingPeak aegisPrestigeFloor aegisLastRatedMatchAt');

  if (players.length === 0) return { modifiedCount: 0 };

  const ops = [];
  for (const p of players) {
    const weeksIdle = Math.floor((Date.now() - p.aegisLastRatedMatchAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const decayAmount = 2 * (weeksIdle - 8);
    const effectiveFloor = Math.max(p.aegisPrestigeFloor || 0, (p.aegisRatingPeak || 0) * 0.80);
    const newRating = Math.max(Math.round(p.aegisRating - decayAmount), Math.round(effectiveFloor));

    if (newRating < p.aegisRating) {
      ops.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { aegisRating: newRating, aegisRatingFloor: Math.round(effectiveFloor) } },
        },
      });
    }
  }

  if (ops.length > 0) {
    await Player.bulkWrite(ops);
  }
  return { modifiedCount: ops.length };
}

// ============================================================================
// PRESTIGE — Update championship counters after tournament conclusion
// ============================================================================

export async function updatePrestigeCounters(tournamentDoc) {
  const tier = tournamentDoc.tier;
  const standings = tournamentDoc.finalStandings || [];
  if (standings.length === 0) return;

  const ops = [];

  for (const standing of standings) {
    const teamId = standing.team;
    if (!teamId) continue;

    const team = await Team.findById(teamId).select('players');
    if (!team?.players?.length) continue;

    const playerIds = team.players;

    if (tier === 'S') {
      if (standing.position === 1) {
        ops.push(...playerIds.map(pid => ({
          updateOne: {
            filter: { _id: pid },
            update: { $inc: { sChampionships: 1 } },
          },
        })));
      }
      if (standing.position <= 3) {
        ops.push(...playerIds.map(pid => ({
          updateOne: {
            filter: { _id: pid },
            update: { $inc: { sTopThree: 1 } },
          },
        })));
      }
    }

    if (tier === 'A' && standing.position === 1) {
      ops.push(...playerIds.map(pid => ({
        updateOne: {
          filter: { _id: pid },
          update: { $inc: { aChampionships: 1 } },
        },
      })));
    }
  }

  if (ops.length > 0) {
    await Player.bulkWrite(ops);

    // Recalculate prestige floors for affected players
    const allPlayerIds = [...new Set(ops.map(op => op.updateOne.filter._id.toString()))];
    const players = await Player.find({ _id: { $in: allPlayerIds } })
      .select('sChampionships aChampionships sTopThree aegisRatingPeak aegisPrestigeFloor');

    const floorOps = [];
    for (const p of players) {
      // Milestone-based floor (simplified tiers)
      let prestigeFloor = 0;
      if ((p.sChampionships || 0) >= 1) prestigeFloor = Math.max(prestigeFloor, 2800);
      if ((p.sTopThree || 0) >= 2) prestigeFloor = Math.max(prestigeFloor, 2500);
      if ((p.aChampionships || 0) >= 2) prestigeFloor = Math.max(prestigeFloor, 2000);
      if ((p.aChampionships || 0) >= 1) prestigeFloor = Math.max(prestigeFloor, 1800);
      if ((p.sTopThree || 0) >= 1) prestigeFloor = Math.max(prestigeFloor, 2200);

      const peakFloor = (p.aegisRatingPeak || 0) * 0.80;
      const effectiveFloor = Math.max(prestigeFloor, peakFloor);

      floorOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              aegisPrestigeFloor: prestigeFloor,
              aegisRatingFloor: Math.round(effectiveFloor),
            },
          },
        },
      });
    }

    if (floorOps.length > 0) await Player.bulkWrite(floorOps);
  }

  console.log(`🏆 Prestige counters updated for tournament ${tournamentDoc._id}`);
}
