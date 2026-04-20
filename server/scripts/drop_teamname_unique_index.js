/**
 * drop_teamname_unique_index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Drops the unique index on teamName from the teams collection.
 * Run ONCE from the server/ directory:
 *   node scripts/drop_teamname_unique_index.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI / MONGODB_URI env var not set');

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('Connected.');

  const db = mongoose.connection.db;
  const collection = db.collection('teams');

  // List current indexes so we know what exists
  const indexes = await collection.indexes();
  console.log('\nCurrent indexes on "teams":');
  indexes.forEach(idx => console.log(' ', JSON.stringify(idx)));

  // Drop the unique teamName index if it exists
  const targetNames = ['teamName_1', 'teamName'];
  let dropped = false;

  for (const idx of indexes) {
    if (targetNames.includes(idx.name) || (idx.key && idx.key.teamName !== undefined && idx.unique)) {
      try {
        await collection.dropIndex(idx.name);
        console.log(`\n✅  Dropped index: ${idx.name}`);
        dropped = true;
      } catch (err) {
        console.warn(`  ⚠  Could not drop ${idx.name}: ${err.message}`);
      }
    }
  }

  if (!dropped) {
    console.log('\n✅  No unique teamName index found — nothing to drop.');
  }

  // Verify remaining indexes
  const remaining = await collection.indexes();
  console.log('\nRemaining indexes:');
  remaining.forEach(idx => console.log(' ', idx.name, '|', JSON.stringify(idx.key)));

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
