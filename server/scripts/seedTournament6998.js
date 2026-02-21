/**
 * seedTournament6998.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates 30 sample teams (4 players each) and registers them for tournament
 * ID: 6998a44234a999a394ffb582
 *
 * Mirrors the exact logic of the live registration route:
 *   POST /api/team-tournament/register/:tournamentId
 *   (teamTournament.routes.js)
 *
 * What this script does:
 *  1. Creates 120 Player documents (all verified, BGMI, India)
 *  2. Creates 30 Team documents (4 players each, captain = first player)
 *  3. Creates 30 Registration documents — status follows the same rule as the route:
 *       • 'approved'  if tournament.isOpenForAll === true
 *       • 'pending'   otherwise
 *     phase / currentStage = tournament.phases[0].name (same as route)
 *  4. Adds team IDs to tournament.phases[0].teams (so the phase dashboard shows them)
 *  5. Updates tournament.participatingTeamsCount and slots.registered
 *
 * Run:
 *   node --env-file=.env scripts/seedTournament6998.js
 *   -- OR (if .env is already loaded by dotenv) --
 *   node scripts/seedTournament6998.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';
import bcrypt from 'bcrypt';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TOURNAMENT_ID = '6998a44234a999a394ffb582';
const TEAM_COUNT = 30;
const PLAYERS_PER_TEAM = 4;
const SEED_PASSWORD = 'player123'; // Hashed — safe for dev/test data

// ─── NAME POOLS ──────────────────────────────────────────────────────────────
const firstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advait', 'Dhruv', 'Kabir', 'Shivansh', 'Ritvik', 'Ansh',
    'Reyansh', 'Daksh', 'Kiaan', 'Yash', 'Aarush', 'Rudra', 'Ved', 'Veer', 'Aayansh', 'Raghav',
    'Rohan', 'Karan', 'Harsh', 'Dev', 'Rishi', 'Tanish', 'Om', 'Siddharth', 'Samar', 'Naveen',
];

const lastNames = [
    'Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Reddy', 'Rao', 'Joshi', 'Mehta',
    'Nair', 'Pillai', 'Iyer', 'Das', 'Bose', 'Ghosh', 'Roy', 'Sinha', 'Saxena', 'Pandey',
    'Mishra', 'Agarwal', 'Desai', 'Kulkarni', 'Shetty', 'Menon', 'Bhat', 'Chopra', 'Malhotra', 'Kapoor',
];

// 30 team names — each unique
const teamNames = [
    'Phoenix Riders', 'Shadow Warriors', 'Thunder Strike', 'Viper Squad', 'Ghost Legion',
    'Apex Predators', 'Iron Wolves', 'Storm Chasers', 'Silent Assassins', 'Dragon Force',
    'Elite Guards', 'Night Hawks', 'Rogue Titans', 'Cyber Ninjas', 'Fatal Five',
    'Blaze Runners', 'Dark Knights', 'Wild Beasts', 'Royal Flush', 'Alpha Squad',
    'Savage Kings', 'Terror Squad', 'Victory Legion', 'Infinite Edge', 'Domination X',
    'Revenge Gaming', 'Legacy Esports', 'Dynasty Pro', 'Empire Strike', 'Uprising Force',
];

// Corresponding 3-letter tags (all ≤ 6 chars, uppercase enforced by schema)
const teamTags = [
    'PHX', 'SDW', 'THN', 'VPR', 'GST',
    'APX', 'IRW', 'STM', 'SLA', 'DRG',
    'ELT', 'NHK', 'RGT', 'CBN', 'FTL',
    'BLZ', 'DKN', 'WLD', 'RYL', 'ALP',
    'SVG', 'TRR', 'VCT', 'INF', 'DMX',
    'RVG', 'LGC', 'DYN', 'EMP', 'UPF',
];

// Valid values per player.model.js enum
const playerInGameRoles = ['Assaulter', 'IGL', 'Support', 'Fragger', 'Sniper'];

// Valid values per registration.model.js roster.role enum
const rosterRoles = ['IGL', 'Fragger', 'Support', 'Sniper', 'Substitute'];

// Valid player.availability enum
const availabilities = ['weekends only', 'evenings', 'flexible', 'full time'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    try {
        console.log('\n🚀  Aegis Seeder — 30 Teams × 4 Players');
        console.log(`🎯  Tournament ID: ${TOURNAMENT_ID}\n`);

        // ── 0. Connect ────────────────────────────────────────────────────────────
        console.log('📡  Connecting to database...');
        await connectDB();
        console.log('✓   Connected\n');

        // ── 1. Validate tournament ────────────────────────────────────────────────
        console.log('🔍  Fetching tournament...');
        const tournament = await Tournament.findById(TOURNAMENT_ID);
        if (!tournament) {
            throw new Error(`Tournament ${TOURNAMENT_ID} not found in DB`);
        }
        if (!tournament.phases || tournament.phases.length === 0) {
            throw new Error('Tournament has no phases — add at least one phase first');
        }

        const firstPhase = tournament.phases[0];
        const firstPhaseName = firstPhase.name || 'Phase 1';

        // Mirrors the route: status is 'approved' if isOpenForAll, else 'pending'
        const registrationStatus = tournament.isOpenForAll ? 'approved' : 'pending';

        console.log(`✓   Tournament : "${tournament.tournamentName}"`);
        console.log(`✓   Status     : ${tournament.status}`);
        console.log(`✓   isOpenForAll: ${tournament.isOpenForAll}`);
        console.log(`✓   First Phase: "${firstPhaseName}"`);
        console.log(`✓   Reg Status will be: "${registrationStatus}"\n`);

        // ── 2. Create 120 Players (30 teams × 4) ─────────────────────────────────
        const totalPlayers = TEAM_COUNT * PLAYERS_PER_TEAM;
        console.log(`👥  Creating ${totalPlayers} players...`);

        const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
        const playerDocs = [];

        // Use a run-unique prefix so re-running won't collide on username/email unique indexes
        const runId = Date.now();

        for (let i = 1; i <= totalPlayers; i++) {
            const firstName = rand(firstNames);
            const lastName = rand(lastNames);
            const username = `seed_${runId}_p${i}`;         // e.g. seed_1708123456789_p1
            const inGameName = `${firstName.slice(0, 3).toUpperCase()}${runId % 1000}${i}`;

            playerDocs.push({
                username,
                inGameName,
                realName: `${firstName} ${lastName}`,
                email: `${username}@seed.aegis.dev`,
                password: hashedPassword,
                isEmailVerified: true,
                verified: true,
                country: 'India',
                primaryGame: 'BGMI',        // matches tournament.gameTitle
                inGameRole: [rand(playerInGameRoles)],
                teamStatus: 'in a team',
                profileVisibility: 'public',
                bio: `Seeded BGMI player — ${firstName} (run ${runId})`,
                availability: rand(availabilities),
                aegisRating: Math.floor(Math.random() * 1500) + 500,
            });
        }

        const insertedPlayers = await Player.insertMany(playerDocs);
        console.log(`✓   ${insertedPlayers.length} players created\n`);

        // ── 3. Create 30 Teams ────────────────────────────────────────────────────
        console.log(`🏆  Creating ${TEAM_COUNT} teams...`);
        const teamDocs = [];
        const teamModels = []; // Keep Team instances for _id reference before insertMany

        // Pre-generate teamIds sequentially to avoid N round-trips inside the loop
        const teamIds = [];
        for (let i = 0; i < TEAM_COUNT; i++) {
            teamIds.push(await Team.generateTeamId());
        }

        for (let i = 0; i < TEAM_COUNT; i++) {
            const slice = insertedPlayers.slice(i * PLAYERS_PER_TEAM, (i + 1) * PLAYERS_PER_TEAM);
            const captainId = slice[0]._id;
            const playerIds = slice.map((p) => p._id);
            const tag = teamTags[i];

            const teamDoc = {
                teamId: teamIds[i],
                teamName: teamNames[i],
                teamTag: tag,
                logo: `https://placehold.co/200x200/0f172a/f8fafc?text=${tag}`,
                captain: captainId,
                players: playerIds,
                primaryGame: 'BGMI',
                region: 'India',
                country: 'India',
                bio: `${teamNames[i]} — competitive BGMI team (seeded run ${runId})`,
                establishedDate: new Date(),
                profileVisibility: 'public',
                status: 'active',
                aegisRating: Math.floor(Math.random() * 1500) + 800,
                statistics: {
                    tournamentsPlayed: Math.floor(Math.random() * 10),
                    matchesPlayed: Math.floor(Math.random() * 50),
                    totalKills: Math.floor(Math.random() * 500),
                    chickenDinners: Math.floor(Math.random() * 10),
                    averagePlacement: Math.floor(Math.random() * 10) + 1,
                    winRate: Math.floor(Math.random() * 40),
                },
            };
            teamDocs.push(teamDoc);
        }

        const insertedTeams = await Team.insertMany(teamDocs);
        console.log(`✓   ${insertedTeams.length} teams created`);

        // Back-fill players' team reference
        const playerSaveOps = insertedPlayers.map((player, idx) => {
            const teamIndex = Math.floor(idx / PLAYERS_PER_TEAM);
            return Player.updateOne(
                { _id: player._id },
                { $set: { team: insertedTeams[teamIndex]._id } }
            );
        });
        await Promise.all(playerSaveOps);
        console.log(`✓   Player.team references updated\n`);

        // ── 4. Create Registration documents ─────────────────────────────────────
        //
        // Mirrors teamTournament.routes.js → POST /register/:tournamentId:
        //   status      = isOpenForAll ? 'approved' : 'pending'
        //   qualifiedThrough = 'open_registration'
        //   currentStage = firstPhase.name
        //   phase        = firstPhase.name
        //   approvedAt   set only when status === 'approved'
        //   roster       = team.players mapped to { player, role, inGameName }
        //
        console.log(`📝  Creating ${TEAM_COUNT} Registration documents...`);
        const registrationDocs = [];

        for (let i = 0; i < insertedTeams.length; i++) {
            const team = insertedTeams[i];
            const teamSlice = insertedPlayers.slice(i * PLAYERS_PER_TEAM, (i + 1) * PLAYERS_PER_TEAM);

            const roster = team.players.map((playerId, idx) => ({
                player: playerId,
                role: rosterRoles[idx] || 'Fragger',
                inGameName: teamSlice[idx]?.inGameName || `Player${idx + 1}`,
            }));

            registrationDocs.push({
                tournament: TOURNAMENT_ID,
                team: team._id,
                status: registrationStatus,
                qualifiedThrough: 'open_registration',
                currentStage: firstPhaseName,
                phase: firstPhaseName,
                group: '',           // to be assigned by admin later
                registeredAt: new Date(),
                approvedAt: registrationStatus === 'approved' ? new Date() : undefined,
                roster,
                totalTournamentPoints: 0,
                totalTournamentKills: 0,
                totalChickenDinners: 0,
                matchesPlayed: 0,
            });
        }

        const insertedRegistrations = await Registration.insertMany(registrationDocs);
        console.log(`✓   ${insertedRegistrations.length} registrations created\n`);

        // ── 5. Update Tournament ──────────────────────────────────────────────────
        //
        // Add team IDs to phases[0].teams so the phase dashboard shows them.
        // Also bump participatingTeamsCount & slots.registered.
        //
        console.log(`📊  Updating tournament (phase + counts)...`);

        if (!firstPhase.teams) firstPhase.teams = [];
        firstPhase.teams.push(...insertedTeams.map((t) => t._id));

        // Only bump 'approved' count in participatingTeamsCount
        if (registrationStatus === 'approved') {
            tournament.participatingTeamsCount =
                (tournament.participatingTeamsCount || 0) + TEAM_COUNT;
        }
        tournament.slots = tournament.slots || {};
        tournament.slots.registered =
            (tournament.slots.registered || 0) + TEAM_COUNT;

        await tournament.save();
        console.log(`✓   Tournament updated\n`);

        // ── 6. Summary ───────────────────────────────────────────────────────────
        console.log('═'.repeat(55));
        console.log(' ✨  SEED COMPLETE — SUMMARY');
        console.log('═'.repeat(55));
        console.log(` Tournament  : "${tournament.tournamentName}"`);
        console.log(` Tournament ID: ${TOURNAMENT_ID}`);
        console.log(` Phase        : "${firstPhaseName}"`);
        console.log(` Players created       : ${insertedPlayers.length}`);
        console.log(` Teams created         : ${insertedTeams.length}`);
        console.log(` Registrations created : ${insertedRegistrations.length}`);
        console.log(` Registration status   : ${registrationStatus}`);
        console.log(` Teams in phase[0]     : ${firstPhase.teams.length}`);
        console.log(` participatingTeamsCount: ${tournament.participatingTeamsCount}`);
        console.log(` slots.registered      : ${tournament.slots.registered}`);
        console.log('═'.repeat(55));
        console.log('\n Credentials for any seeded player:');
        console.log(`   email    : seed_${runId}_p<N>@seed.aegis.dev`);
        console.log(`   password : ${SEED_PASSWORD}`);
        console.log('═'.repeat(55) + '\n');

        await mongoose.disconnect();
        console.log('✅  Done — DB disconnected.\n');
        process.exit(0);

    } catch (err) {
        console.error('\n❌  Seeder failed:', err.message);
        console.error(err);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    }
}

main();
