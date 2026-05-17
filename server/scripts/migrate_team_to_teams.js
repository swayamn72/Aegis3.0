/**
 * migrate_team_to_teams.js
 *
 * One-time migration: copies player.team (legacy single ObjectId) into
 * the new player.teams Map field (keyed by the team's primaryGame).
 *
 * Safe to re-run — players whose teams.{game} is already set are skipped.
 *
 * Usage:
 *   node server/scripts/migrate_team_to_teams.js
 *
 * Requires: MONGODB_URI in environment (.env)
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ── DB connection ─────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌  MONGO_URI is not set in environment');
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log('✅  Connected to MongoDB');

// ── Minimal schemas (avoid loading full app models) ───────────────────────────
const TeamMini = mongoose.model('Team', new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  primaryGame: String,
}), 'teams');

const PlayerMini = mongoose.model('Player', new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },   // legacy field (read-only)
  teams: { type: Map, of: mongoose.Schema.Types.ObjectId, default: new Map() },
  primaryGame: String,
}), 'players');

// ── Migration logic ───────────────────────────────────────────────────────────
const BATCH_SIZE = 500;
let processed = 0;
let migrated  = 0;
let skipped   = 0;
let errors    = 0;

console.log('🔄  Starting migration: player.team → player.teams ...\n');

// Iterate over players that still have the legacy `team` field set
const cursor = PlayerMini.find({ team: { $ne: null } }).cursor();

for await (const player of cursor) {
  processed++;

  try {
    const legacyTeamId = player.team;
    if (!legacyTeamId) { skipped++; continue; }

    // Fetch team to get primaryGame
    const team = await TeamMini.findById(legacyTeamId).select('primaryGame').lean();
    if (!team || !team.primaryGame) {
      console.warn(`  ⚠️  Player ${player._id}: legacy team ${legacyTeamId} not found or has no primaryGame — skipping`);
      skipped++;
      continue;
    }

    const game = team.primaryGame;

    // Skip if already migrated for this game
    const existingForGame = player.teams?.get?.(game) ?? player.teams?.[game];
    if (existingForGame) {
      skipped++;
      continue;
    }

    // Set teams.{game} = legacyTeamId
    await PlayerMini.updateOne(
      { _id: player._id },
      { $set: { [`teams.${game}`]: legacyTeamId } }
    );

    migrated++;

    if (migrated % BATCH_SIZE === 0) {
      console.log(`  … migrated ${migrated} players so far`);
    }
  } catch (err) {
    errors++;
    console.error(`  ❌  Error processing player ${player._id}:`, err.message);
  }
}

console.log('\n═══════════════════════════════════════════════');
console.log(`✅  Migration complete`);
console.log(`   Processed : ${processed}`);
console.log(`   Migrated  : ${migrated}`);
console.log(`   Skipped   : ${skipped} (already migrated or no team)`);
console.log(`   Errors    : ${errors}`);
console.log('═══════════════════════════════════════════════\n');

await mongoose.disconnect();
process.exit(errors > 0 ? 1 : 0);
