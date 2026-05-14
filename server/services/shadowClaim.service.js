import mongoose from 'mongoose';
import Player from '../models/player.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import RatingEvent from '../models/ratingEvent.model.js';

/**
 * Shadow Claim Service
 *
 * Admin-initiated transfer of a shadow (admin-created) player profile
 * into a real user's account. All historical data is re-pointed:
 * - RatingEvent documents
 * - Match results kill breakdowns
 * - Registration rosters
 * - Stats (takes the higher aegisRating)
 *
 * The shadow profile is NOT deleted — it's flagged as `claimedBy` for audit.
 * Uses MongoDB transactions for atomicity.
 */

export async function claimShadowProfile(shadowPlayerId, realPlayerId, adminId) {
  // --- Validate inputs ---
  if (!mongoose.Types.ObjectId.isValid(shadowPlayerId)) {
    throw new Error('Invalid shadow player ID');
  }
  if (!mongoose.Types.ObjectId.isValid(realPlayerId)) {
    throw new Error('Invalid real player ID');
  }
  if (shadowPlayerId.toString() === realPlayerId.toString()) {
    throw new Error('Cannot claim a profile into itself');
  }

  const shadowPlayer = await Player.findById(shadowPlayerId);
  if (!shadowPlayer) {
    throw new Error('Shadow player not found');
  }
  if (!shadowPlayer.isShadowProfile) {
    throw new Error('Player is not a shadow profile');
  }
  if (shadowPlayer.claimedBy) {
    throw new Error('Shadow profile has already been claimed');
  }

  const realPlayer = await Player.findById(realPlayerId);
  if (!realPlayer) {
    throw new Error('Real player not found');
  }
  if (realPlayer.isShadowProfile) {
    throw new Error('Target player is also a shadow profile');
  }

  const shadowId = shadowPlayer._id;
  const realId = realPlayer._id;

  // --- Use a session for transactional safety ---
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1. Transfer RatingEvent documents
      const ratingResult = await RatingEvent.updateMany(
        { player: shadowId },
        { $set: { player: realId } },
        { session }
      );
      console.log(`📊 Transferred ${ratingResult.modifiedCount} RatingEvent docs`);

      // 2. Transfer Match kill breakdowns
      //    Update results[].kills.breakdown[].player where it matches shadowId
      const matchResult = await Match.updateMany(
        { 'results.kills.breakdown.player': shadowId },
        { $set: { 'results.$[].kills.breakdown.$[elem].player': realId } },
        {
          arrayFilters: [{ 'elem.player': shadowId }],
          session,
        }
      );
      console.log(`🎮 Updated ${matchResult.modifiedCount} Match docs`);

      // 3. Transfer Registration rosters
      const regResult = await Registration.updateMany(
        { 'roster.player': shadowId },
        { $set: { 'roster.$[elem].player': realId } },
        {
          arrayFilters: [{ 'elem.player': shadowId }],
          session,
        }
      );
      console.log(`📝 Updated ${regResult.modifiedCount} Registration docs`);

      // 4. Transfer stats to real player (take the higher values)
      const statsUpdate = {};

      // Take the higher aegisRating
      if (shadowPlayer.aegisRating > realPlayer.aegisRating) {
        statsUpdate.aegisRating = shadowPlayer.aegisRating;
      }
      if ((shadowPlayer.aegisRatingPeak || 0) > (realPlayer.aegisRatingPeak || 0)) {
        statsUpdate.aegisRatingPeak = shadowPlayer.aegisRatingPeak;
      }
      if ((shadowPlayer.aegisPrestigeFloor || 0) > (realPlayer.aegisPrestigeFloor || 0)) {
        statsUpdate.aegisPrestigeFloor = shadowPlayer.aegisPrestigeFloor;
      }

      // Accumulate match/tournament counts
      statsUpdate['statistics.matchesPlayed'] =
        (realPlayer.statistics?.matchesPlayed || 0) + (shadowPlayer.statistics?.matchesPlayed || 0);
      statsUpdate['statistics.totalKills'] =
        (realPlayer.statistics?.totalKills || 0) + (shadowPlayer.statistics?.totalKills || 0);
      statsUpdate['statistics.tournamentsPlayed'] =
        (realPlayer.statistics?.tournamentsPlayed || 0) + (shadowPlayer.statistics?.tournamentsPlayed || 0);
      statsUpdate['statistics.matchesWon'] =
        (realPlayer.statistics?.matchesWon || 0) + (shadowPlayer.statistics?.matchesWon || 0);

      // Accumulate championship counters
      statsUpdate.sChampionships =
        (realPlayer.sChampionships || 0) + (shadowPlayer.sChampionships || 0);
      statsUpdate.aChampionships =
        (realPlayer.aChampionships || 0) + (shadowPlayer.aChampionships || 0);
      statsUpdate.sTopThree =
        (realPlayer.sTopThree || 0) + (shadowPlayer.sTopThree || 0);

      // Accumulate rated matches count
      statsUpdate.aegisMatchesRated =
        (realPlayer.aegisMatchesRated || 0) + (shadowPlayer.aegisMatchesRated || 0);
      statsUpdate.aegisIsProvisional = statsUpdate.aegisMatchesRated < 20;

      // Transfer game IDs from shadow if real player doesn't have them
      const existingCharIds = new Set(
        (realPlayer.gameIds || []).map(g => g.characterId)
      );
      const newGameIds = (shadowPlayer.gameIds || []).filter(
        g => !existingCharIds.has(g.characterId)
      );

      await Player.findByIdAndUpdate(
        realId,
        {
          $set: statsUpdate,
          ...(newGameIds.length > 0 ? { $push: { gameIds: { $each: newGameIds } } } : {}),
        },
        { session }
      );
      console.log(`📈 Stats transferred to real player`);

      // 5. Mark shadow as claimed (keep for audit trail)
      await Player.findByIdAndUpdate(
        shadowId,
        {
          $set: {
            claimedBy: realId,
            claimedAt: new Date(),
          },
        },
        { session }
      );
      console.log(`✅ Shadow profile ${shadowId} claimed by ${realId}`);
    });

    return {
      success: true,
      shadowPlayerId: shadowId,
      realPlayerId: realId,
      message: 'Shadow profile successfully claimed and data transferred',
    };
  } catch (error) {
    console.error('❌ Shadow claim failed:', error);
    throw error;
  } finally {
    await session.endSession();
  }
}
