/**
 * Multi-Game Migration Script
 *
 * Run ONCE before deploying multi-game code to production.
 * Idempotent — safe to run multiple times.
 *
 * Steps:
 * 1. Add gameTitle='BGMI' to all tournaments
 * 2. Add gameTitle='BGMI' to all matches
 * 3. Add gameTitle='BGMI' to all registrations
 * 4. Add gameTitle='BGMI' to all phase standings
 * 5. Add game='BGMI' to all gameId entries in players
 *
 * Usage: node server/scripts/migrate_multi_game.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

// Import models to register schemas
import Tournament from '../models/tournament.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import Player from '../models/player.model.js';

// PhaseStanding import (collection name may differ)
let PhaseStanding;
try {
  PhaseStanding = (await import('../models/phaseStanding.model.js')).default;
} catch (e) {
  console.warn('⚠️ PhaseStanding model not found, skipping phase standing migration.');
}

async function migrate() {
  console.log('🚀 Multi-Game Migration Script');
  console.log('================================');

  await connectDB();

  // Wait for connection
  while (mongoose.connection.readyState !== 1) {
    await new Promise(r => setTimeout(r, 500));
  }

  // ── Step 1: Tournaments ──────────────────────────────────────────────
  console.log('\n📌 Step 1: Tagging tournaments with gameTitle=BGMI...');
  const tournResult = await Tournament.updateMany(
    { gameTitle: { $exists: false } },
    { $set: { gameTitle: 'BGMI' } }
  );
  console.log(`   ✅ Updated ${tournResult.modifiedCount} tournaments`);

  // Also update any with missing gameTitle
  const tournResult2 = await Tournament.updateMany(
    { gameTitle: null },
    { $set: { gameTitle: 'BGMI' } }
  );
  console.log(`   ✅ Fixed ${tournResult2.modifiedCount} null-gameTitle tournaments`);

  // ── Step 2: Matches ──────────────────────────────────────────────────
  console.log('\n📌 Step 2: Tagging matches with gameTitle=BGMI...');
  const matchResult = await Match.updateMany(
    { gameTitle: { $exists: false } },
    { $set: { gameTitle: 'BGMI' } }
  );
  console.log(`   ✅ Updated ${matchResult.modifiedCount} matches`);

  const matchResult2 = await Match.updateMany(
    { gameTitle: null },
    { $set: { gameTitle: 'BGMI' } }
  );
  console.log(`   ✅ Fixed ${matchResult2.modifiedCount} null-gameTitle matches`);

  // ── Step 3: Registrations ────────────────────────────────────────────
  console.log('\n📌 Step 3: Tagging registrations with gameTitle=BGMI...');
  const regResult = await Registration.updateMany(
    { gameTitle: { $exists: false } },
    { $set: { gameTitle: 'BGMI' } }
  );
  console.log(`   ✅ Updated ${regResult.modifiedCount} registrations`);

  // ── Step 4: Phase Standings ──────────────────────────────────────────
  if (PhaseStanding) {
    console.log('\n📌 Step 4: Tagging phase standings with gameTitle=BGMI...');
    const standResult = await PhaseStanding.updateMany(
      { gameTitle: { $exists: false } },
      { $set: { gameTitle: 'BGMI' } }
    );
    console.log(`   ✅ Updated ${standResult.modifiedCount} phase standings`);
  } else {
    console.log('\n📌 Step 4: Skipped (PhaseStanding model not available)');
  }

  // ── Step 5: Player gameIds ───────────────────────────────────────────
  console.log('\n📌 Step 5: Tagging player gameIds with game=BGMI...');
  // Find all players who have gameIds without a game field
  const players = await Player.find({
    'gameIds': { $elemMatch: { game: { $exists: false } } }
  }).select('gameIds');

  let updatedPlayers = 0;
  for (const player of players) {
    let modified = false;
    for (const gid of player.gameIds) {
      if (!gid.game) {
        gid.game = 'BGMI';
        modified = true;
      }
    }
    if (modified) {
      await player.save();
      updatedPlayers++;
    }
  }
  console.log(`   ✅ Updated ${updatedPlayers} players' gameIds`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n================================');
  console.log('✅ Migration complete!');
  console.log('Summary:');
  console.log(`   Tournaments: ${tournResult.modifiedCount + tournResult2.modifiedCount}`);
  console.log(`   Matches:     ${matchResult.modifiedCount + matchResult2.modifiedCount}`);
  console.log(`   Registrations: ${regResult.modifiedCount}`);
  console.log(`   Players:     ${updatedPlayers}`);
  console.log('\n💡 You can safely run this script again — it is idempotent.');

  await mongoose.connection.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
