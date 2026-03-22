import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';

ido();

async function ido() {
  try {
    await connectDB();
    console.log('🔗 Connected to DB');

    // --- Seed Player rating fields ---
    const playerResult = await Player.updateMany(
      { aegisMatchesRated: { $exists: false } },
      {
        $set: {
          aegisRating: 1000,
          aegisRatingPeak: 1000,
          aegisRatingFloor: 0,
          aegisPrestigeFloor: 0,
          aegisMatchesRated: 0,
          aegisIsProvisional: true,
          aegisLastRatedMatchAt: null,
          sChampionships: 0,
          aChampionships: 0,
          sTopThree: 0,
        },
      }
    );
    console.log(`✅ Migrated ${playerResult.modifiedCount} player documents.`);

    // --- Seed Tournament importanceScore ---
    const tournResult = await Tournament.updateMany(
      { importanceScore: { $exists: false } },
      { $set: { importanceScore: 50 } }
    );
    console.log(`✅ Migrated ${tournResult.modifiedCount} tournament documents.`);

    // --- Seed Registration direct-invite fields ---
    const regResult = await Registration.updateMany(
      { isDirectInvite: { $exists: false } },
      { $set: { isDirectInvite: false, seedPhase: null, seedRating: null } }
    );
    console.log(`✅ Migrated ${regResult.modifiedCount} registration documents.`);

    console.log('🎉 Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}
