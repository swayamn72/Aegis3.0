/**
 * generateSampleRegistrations.js
 *
 * Creates 800 sample teams (3 200 players, 4 per team) and registers every
 * team for the target tournament.
 *
 * Usage (from /server):
 *   node --experimental-vm-modules scripts/generateSampleRegistrations.js
 *  – or via npm script –
 *   node scripts/generateSampleRegistrations.js
 *
 * Idempotent guard: uses a RUN_TAG so you can identify & roll back seeded
 * data later.  All generated usernames / emails / team names carry the tag.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';

// ─── Config ────────────────────────────────────────────────────────────────
const TOURNAMENT_ID    = '69e3b89cd4d0b45f6b300881';
const TOTAL_TEAMS      = 800;
const PLAYERS_PER_TEAM = 4;
const CHUNK_SIZE       = 100;   // teams per DB round-trip
const RUN_TAG          = `SEED800_${Date.now()}`;

// Characters for teamId / teamTag generation
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Random 9-digit numeric string (BGMI-style character ID). */
function randomCharacterId() {
  return String(Math.floor(100_000_000 + Math.random() * 900_000_000));
}

/**
 * Deterministic 6-char alphanumeric teamId from a sequential index.
 * `salt` lets us retry if there is a collision.
 */
function makeTeamId(index, salt = 0) {
  const n = index + salt * TOTAL_TEAMS;
  let s = n.toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return s;
}

/**
 * teamTag: exactly 4 uppercase chars.  Encode the index as base-36, pad/trim
 * to 4 chars so it always fits the model's maxlength:6.
 */
function makeTeamTag(index) {
  return index.toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Connect ────────────────────────────────────────────────────────────
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected.');

  // ── 2. Validate tournament ────────────────────────────────────────────────
  const tournament = await Tournament.findById(TOURNAMENT_ID)
    .select('tournamentName gameTitle status registrationEndDate slots isOpenForAll requiresApproval participatingTeamsCount')
    .lean();

  if (!tournament) {
    throw new Error(`Tournament not found: ${TOURNAMENT_ID}`);
  }

  console.log(`🏆 Tournament : ${tournament.tournamentName}`);
  console.log(`🎮 Game       : ${tournament.gameTitle}`);
  console.log(`📌 Status     : ${tournament.status}`);

  // Allow seeding into any non-cancelled/non-completed tournament.
  const ALLOWED_STATUSES = ['announced','registration_open','registration_closed','in_progress'];
  if (!ALLOWED_STATUSES.includes(tournament.status)) {
    throw new Error(`Tournament status "${tournament.status}" is not seedable.`);
  }

  // ── 3. Capacity guard ─────────────────────────────────────────────────────
  const existingActiveCount = await Registration.countDocuments({
    tournament: TOURNAMENT_ID,
    status: { $in: ['approved', 'checked_in', 'pending'] },
  });
  const slotsTotal     = Number(tournament.slots?.total ?? 0);
  const remainingSlots = slotsTotal - existingActiveCount;

  console.log(`🪣 Slots total / used / remaining: ${slotsTotal} / ${existingActiveCount} / ${remainingSlots}`);

  if (slotsTotal > 0 && remainingSlots < TOTAL_TEAMS) {
    throw new Error(
      `Not enough capacity: need ${TOTAL_TEAMS} slots, only ${remainingSlots} remain ` +
      `(total=${slotsTotal}, existing=${existingActiveCount}).`
    );
  }

  // Auto-approve when the tournament is open-for-all without manual review.
  const autoApprove = !!(tournament.isOpenForAll && !tournament.requiresApproval);
  const regStatus   = autoApprove ? 'approved' : 'approved'; // seed as approved for testing
  console.log(`📋 Registration status will be: ${regStatus}`);

  // ── 4. Load existing teamIds to avoid collisions ──────────────────────────
  const usedTeamIds = new Set(
    (await Team.find({}, { teamId: 1, _id: 0 }).lean()).map(t => t.teamId)
  );

  // ── 5. Generate & insert in chunks ────────────────────────────────────────
  const totalChunks = Math.ceil(TOTAL_TEAMS / CHUNK_SIZE);
  let totalRegistered = 0;

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const chunkStart  = chunkIdx * CHUNK_SIZE;
    const chunkEnd    = Math.min(chunkStart + CHUNK_SIZE, TOTAL_TEAMS);
    const chunkSize   = chunkEnd - chunkStart;

    console.log(`\n📦 Chunk ${chunkIdx + 1}/${totalChunks}  (teams ${chunkStart + 1}–${chunkEnd})…`);

    // ── 5a. Build player docs ──────────────────────────────────────────────
    const playerDocs   = [];
    const teamDocs     = [];
    const regDocs      = [];
    const playerTeamMap = []; // { playerId, teamId(ObjectId) }

    for (let ti = 0; ti < chunkSize; ti++) {
      const globalTeamIndex = chunkStart + ti + 1;   // 1-based across all chunks
      const teamObjId       = new mongoose.Types.ObjectId();
      const rosterIds       = [];
      const roster          = [];

      /* -- Players for this team -- */
      for (let pi = 0; pi < PLAYERS_PER_TEAM; pi++) {
        const playerObjId = new mongoose.Types.ObjectId();
        const uname = `${RUN_TAG}_T${globalTeamIndex}_P${pi + 1}`;

        playerDocs.push({
          _id: playerObjId,
          username: uname,
          email: `${uname.toLowerCase()}@seed.aegis.local`,
          country: 'India',
          primaryGame: 'BGMI',
          aegisRating: 800 + Math.floor(Math.random() * 600),
          gameIds: [{
            inGameName: `${uname}_IGN`,
            characterId: randomCharacterId(),
            isPrimary: true,
          }],
          teamStatus: 'in a team',
          verified: true,
          isEmailVerified: true,
        });

        rosterIds.push(playerObjId);
        roster.push({ player: playerObjId, inGameName: `${uname}_IGN` });
        playerTeamMap.push({ playerId: playerObjId, teamObjId });
      }

      /* -- Unique teamId -- */
      let salt = 0;
      let candidate = makeTeamId(globalTeamIndex, salt);
      while (usedTeamIds.has(candidate)) {
        salt++;
        candidate = makeTeamId(globalTeamIndex, salt);
      }
      usedTeamIds.add(candidate);

      teamDocs.push({
        _id: teamObjId,
        teamId: candidate,
        teamName: `${RUN_TAG}_TEAM_${globalTeamIndex}`,
        teamTag: makeTeamTag(globalTeamIndex),  // 4 chars, always fits maxlength:6
        primaryGame: 'BGMI',
        captain: rosterIds[0],
        players: rosterIds,
        aegisRating: 0,
        region: 'India',
        status: 'active',
      });

      regDocs.push({
        tournament: TOURNAMENT_ID,
        team: teamObjId,
        status: regStatus,
        qualifiedThrough: 'open_registration',
        currentStage: 'Registered',
        phase: null,
        roster,
        registeredAt: new Date(),
        approvedAt: regStatus === 'approved' ? new Date() : undefined,
      });
    }

    // ── 5b. Insert players ────────────────────────────────────────────────
    await Player.insertMany(playerDocs, { ordered: false });
    console.log(`  ✅ ${playerDocs.length} players inserted`);

    // ── 5c. Insert teams ──────────────────────────────────────────────────
    await Team.insertMany(teamDocs, { ordered: false });
    console.log(`  ✅ ${teamDocs.length} teams inserted`);

    // ── 5d. Link players → team (set player.team + teamStatus) ───────────
    const bulkOps = playerTeamMap.map(({ playerId, teamObjId }) => ({
      updateOne: {
        filter: { _id: playerId },
        update: { $set: { team: teamObjId, teamStatus: 'in a team' } },
      },
    }));
    await Player.bulkWrite(bulkOps, { ordered: false });
    console.log(`  ✅ ${bulkOps.length} players linked to their teams`);

    // ── 5e. Insert registrations ──────────────────────────────────────────
    // insertMany bypasses the post-save hook, so we sync counters manually
    // after all chunks are done (step 6).
    await Registration.insertMany(regDocs, { ordered: false });
    totalRegistered += chunkSize;
    console.log(`  ✅ ${chunkSize} registrations inserted  (${totalRegistered}/${TOTAL_TEAMS} total)`);
  }

  // ── 6. Sync tournament counters ───────────────────────────────────────────
  console.log('\n🔄 Syncing tournament counters…');

  const finalRegisteredCount = await Registration.countDocuments({
    tournament: TOURNAMENT_ID,
  });
  const finalActiveCount = await Registration.countDocuments({
    tournament: TOURNAMENT_ID,
    status: { $in: ['approved', 'checked_in'] },
  });

  await Tournament.updateOne(
    { _id: TOURNAMENT_ID },
    {
      $set: {
        'slots.registered': finalRegisteredCount,
        participatingTeamsCount: finalActiveCount,
      },
    }
  );

  console.log(`  slots.registered       = ${finalRegisteredCount}`);
  console.log(`  participatingTeamsCount = ${finalActiveCount}`);

  // ── 7. Final summary ──────────────────────────────────────────────────────
  const breakdown = await Registration.countByStatus(TOURNAMENT_ID);
  console.log('\n📊 Registration status breakdown:');
  breakdown.forEach(b => console.log(`   ${b._id}: ${b.count}`));

  console.log(`\n🎉 Done!  Run tag: ${RUN_TAG}`);
  console.log(`   To roll back this seed, delete all documents where:`);
  console.log(`   • Player.username starts with "${RUN_TAG}"`);
  console.log(`   • Team.teamName   starts with "${RUN_TAG}"`);
}

main()
  .catch(err => {
    console.error('\n❌ Seed failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
    console.log('🔌 Disconnected from MongoDB.');
  });
