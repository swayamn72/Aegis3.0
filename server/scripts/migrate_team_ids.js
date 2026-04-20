/**
 * migrate_team_ids.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-shot migration: assigns a unique 6-char alphanumeric teamId to every
 * Team document that currently has none (null / undefined).
 *
 * Run from the server/ directory:
 *   node scripts/migrate_team_ids.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Team from '../models/team.model.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ID_LEN = 6;

// Generate a candidate ID string
function makeCandidate() {
  let id = '';
  for (let i = 0; i < ID_LEN; i++) {
    id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return id;
}

// Generate a globally-unique ID not already in the used-set or DB
async function generateUnique(usedSet) {
  let candidate;
  let tries = 0;
  do {
    if (++tries > 1000) throw new Error('Too many collisions – check DB state');
    candidate = makeCandidate();
  } while (
    usedSet.has(candidate) ||
    (await Team.exists({ teamId: candidate }))
  );
  usedSet.add(candidate);
  return candidate;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI / MONGODB_URI env var not set');

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('Connected.');

  // Find all teams WITHOUT a teamId
  const teams = await Team.find({
    $or: [{ teamId: { $exists: false } }, { teamId: null }, { teamId: '' }],
  }).select('_id teamName teamId');

  if (teams.length === 0) {
    console.log('✅  All teams already have a teamId – nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${teams.length} team(s) without a teamId. Migrating…`);

  const usedThisRun = new Set();
  let updated = 0;
  let failed = 0;

  for (const team of teams) {
    try {
      const newId = await generateUnique(usedThisRun);
      await Team.updateOne({ _id: team._id }, { $set: { teamId: newId } });
      console.log(`  ✔  ${team.teamName} (${team._id}) → ${newId}`);
      updated++;
    } catch (err) {
      console.error(`  ✘  Failed for ${team.teamName}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${updated} updated, ${failed} failed.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
