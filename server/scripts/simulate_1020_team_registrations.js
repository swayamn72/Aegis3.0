import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TOURNAMENT_ID = process.argv[2] || '69d24203d5524e57c388333f';
const TEAM_COUNT = Number.parseInt(process.argv[3] || '1020', 10);
const PLAYERS_PER_TEAM = 4;

const SUPPORTED_GAMES = new Set(['BGMI', 'VALORANT']);

function isObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
}

function randomCharacterId() {
    return String(Math.floor(100000000 + Math.random() * 900000000));
}

function teamIdFrom(counter, salt = 0) {
    // 6-char alphanumeric uppercase required by Team model.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const head = alphabet[salt % alphabet.length];
    const body = counter.toString(36).toUpperCase().padStart(5, '0').slice(-5);
    return `${head}${body}`;
}

async function run() {
    if (!isObjectId(TOURNAMENT_ID)) {
        throw new Error(`Invalid tournament id: ${TOURNAMENT_ID}`);
    }
    if (!Number.isFinite(TEAM_COUNT) || TEAM_COUNT <= 0) {
        throw new Error(`Invalid team count: ${TEAM_COUNT}`);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findById(TOURNAMENT_ID)
        .select('tournamentName gameTitle status registrationEndDate slots isOpenForAll requiresApproval')
        .lean();

    if (!tournament) {
        throw new Error(`Tournament not found: ${TOURNAMENT_ID}`);
    }

    if (!SUPPORTED_GAMES.has(tournament.gameTitle)) {
        throw new Error(
            `Tournament gameTitle "${tournament.gameTitle}" is unsupported by Team.primaryGame enum.`,
        );
    }

    if (!['registration_open', 'announced'].includes(tournament.status)) {
        throw new Error(
            `Tournament status is "${tournament.status}". Registration flow allows only announced/registration_open.`,
        );
    }

    if (tournament.registrationEndDate && new Date() > new Date(tournament.registrationEndDate)) {
        throw new Error('Registration deadline has already passed.');
    }

    const existingRegCount = await Registration.countDocuments({
        tournament: TOURNAMENT_ID,
        status: { $in: ['approved', 'checked_in', 'pending'] },
    });

    const slotsTotal = Number(tournament.slots?.total || 0);
    const remainingCapacity = slotsTotal - existingRegCount;
    if (remainingCapacity < TEAM_COUNT) {
        throw new Error(
            `Not enough capacity. slots.total=${slotsTotal}, existing active+pending=${existingRegCount}, remaining=${remainingCapacity}, requested=${TEAM_COUNT}`,
        );
    }

    console.log(`Tournament: ${tournament.tournamentName}`);
    console.log(`Game: ${tournament.gameTitle}`);
    console.log(`Capacity OK: ${remainingCapacity} slots available`);

    const runTag = `SIM1020_${Date.now()}`;
    const autoApprove = !!(tournament.isOpenForAll && !tournament.requiresApproval);
    const registrationStatus = autoApprove ? 'approved' : 'pending';

    // Build a set to ensure generated teamId values are unique.
    const existingTeamIds = new Set(
        (await Team.find({}, { teamId: 1, _id: 0 }).lean()).map((t) => t.teamId),
    );

    const playerDocs = [];
    const teamDocs = [];
    const playerTeamAssignments = [];
    const registrationDocs = [];

    for (let teamIndex = 1; teamIndex <= TEAM_COUNT; teamIndex++) {
        const teamObjectId = new mongoose.Types.ObjectId();
        const rosterPlayerIds = [];
        const roster = [];

        for (let playerIndex = 1; playerIndex <= PLAYERS_PER_TEAM; playerIndex++) {
            const playerObjectId = new mongoose.Types.ObjectId();
            const uname = `${runTag}_T${teamIndex}_P${playerIndex}`;

            playerDocs.push({
                _id: playerObjectId,
                username: uname,
                email: `${uname.toLowerCase()}@seed.aegis.local`,
                gameIds: [
                    {
                        inGameName: `${uname}_IGN`,
                        characterId: randomCharacterId(),
                        isPrimary: true,
                    },
                ],
                primaryGame: tournament.gameTitle,
                teamStatus: 'in a team',
            });

            rosterPlayerIds.push(playerObjectId);
            roster.push({ player: playerObjectId, inGameName: `${uname}_IGN` });
            playerTeamAssignments.push({ _id: playerObjectId, team: teamObjectId });
        }

        let salt = 0;
        let candidate = teamIdFrom(teamIndex, salt);
        while (existingTeamIds.has(candidate)) {
            salt += 1;
            candidate = teamIdFrom(teamIndex, salt);
        }
        existingTeamIds.add(candidate);

        teamDocs.push({
            _id: teamObjectId,
            teamId: candidate,
            teamName: `${runTag}_TEAM_${teamIndex}`,
            teamTag: `S${teamIndex.toString().padStart(3, '0')}`,
            captain: rosterPlayerIds[0],
            players: rosterPlayerIds,
            primaryGame: tournament.gameTitle,
            region: 'India',
            status: 'active',
        });

        registrationDocs.push({
            tournament: TOURNAMENT_ID,
            team: teamObjectId,
            status: registrationStatus,
            qualifiedThrough: 'open_registration',
            currentStage: 'Registered',
            phase: null,
            approvedAt: autoApprove ? new Date() : undefined,
            roster,
        });
    }

    console.log(`Prepared ${playerDocs.length} players, ${teamDocs.length} teams, ${registrationDocs.length} registrations`);

    // Insert in phases to avoid huge single-op payload spikes.
    const CHUNK = 250;
    for (let i = 0; i < playerDocs.length; i += CHUNK) {
        await Player.insertMany(playerDocs.slice(i, i + CHUNK), { ordered: true });
    }
    console.log('Inserted players');

    for (let i = 0; i < teamDocs.length; i += CHUNK) {
        await Team.insertMany(teamDocs.slice(i, i + CHUNK), { ordered: true });
    }
    console.log('Inserted teams');

    // Keep player.team + teamStatus consistent with team membership.
    const bulkPlayerUpdates = playerTeamAssignments.map((p) => ({
        updateOne: {
            filter: { _id: p._id },
            update: { $set: { team: p.team, teamStatus: 'in a team' } },
        },
    }));
    for (let i = 0; i < bulkPlayerUpdates.length; i += 1000) {
        await Player.bulkWrite(bulkPlayerUpdates.slice(i, i + 1000), { ordered: false });
    }
    console.log('Linked players to teams');

    for (let i = 0; i < registrationDocs.length; i += CHUNK) {
        await Registration.insertMany(registrationDocs.slice(i, i + CHUNK), { ordered: true });
    }
    console.log(`Inserted registrations with status=${registrationStatus}`);

    // insertMany bypasses document save hooks, so sync tournament counters manually.
    const registeredCount = await Registration.countDocuments({
        tournament: TOURNAMENT_ID,
    });
    const activeCount = await Registration.countDocuments({
        tournament: TOURNAMENT_ID,
        status: { $in: ['approved', 'checked_in'] },
    });
    await Tournament.updateOne(
        { _id: TOURNAMENT_ID },
        {
            $set: {
                'slots.registered': registeredCount,
                participatingTeamsCount: activeCount,
            },
        },
    );
    console.log(
        `Synced tournament counters: slots.registered=${registeredCount}, participatingTeamsCount=${activeCount}`,
    );

    const finalStats = await Registration.countByStatus(TOURNAMENT_ID);
    console.log('Registration status breakdown:', finalStats);
    console.log(`Done. Run tag: ${runTag}`);
}

run()
    .catch((err) => {
        console.error('Simulation failed:', err.message || err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => { });
    });
