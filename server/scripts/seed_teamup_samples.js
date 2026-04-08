import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import LFTPost from '../models/lftPost.model.js';
import LFPPost from '../models/lfpPost.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RUN_TAG = `TEAMUP_DEMO_${Date.now()}`;
const FREE_AGENTS = 8;
const TEAM_COUNT = 3;
const PLAYERS_PER_TEAM = 4;

const GAMES = ['BGMI', 'VALO', 'CS2'];
const REGIONS = ['India', 'Asia', 'Europe', 'North America', 'Global'];
const ROLES = ['IGL', 'Assaulter', 'Support', 'Sniper', 'Fragger'];

function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function randomCharacterId() {
    return String(Math.floor(100000000 + Math.random() * 900000000));
}

async function generateUniqueTeamId() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    while (true) {
        let id = '';
        for (let i = 0; i < 6; i += 1) {
            id += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        const exists = await Team.exists({ teamId: id });
        if (!exists) return id;
    }
}

function playerDoc({ username, email, game, teamStatus, teamId = null, role }) {
    return {
        username,
        email,
        gameIds: [
            {
                inGameName: `${username}_IGN`,
                characterId: randomCharacterId(),
                isPrimary: true,
            },
        ],
        realName: username.replace(/_/g, ' '),
        primaryGame: game,
        inGameRole: [role],
        location: randomFrom(REGIONS),
        age: 19 + Math.floor(Math.random() * 8),
        teamStatus,
        team: teamId,
        verified: true,
        isEmailVerified: true,
        bio: `Sample profile for ${RUN_TAG}`,
    };
}

async function run() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not configured in server/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const createdFreeAgents = [];
    const createdTeams = [];
    const createdTeamPlayers = [];

    // Create free-agent players + LFT posts
    for (let i = 1; i <= FREE_AGENTS; i += 1) {
        const game = randomFrom(GAMES);
        const role = randomFrom(ROLES);
        const username = `${RUN_TAG}_FA_${i}`;

        const player = await Player.create(
            playerDoc({
                username,
                email: `${username.toLowerCase()}@demo.aegis.local`,
                game,
                role,
                teamStatus: 'looking for a team',
            }),
        );

        createdFreeAgents.push(player);

        await LFTPost.create({
            player: player._id,
            description: `Hey! I am a ${role} main looking for a ${game} team with regular scrims and tournaments. [${RUN_TAG}]`,
            game,
            roles: [role],
            region: randomFrom(REGIONS),
            status: 'active',
        });
    }

    // Create teams + players + LFP posts
    for (let t = 1; t <= TEAM_COUNT; t += 1) {
        const game = randomFrom(GAMES);
        const region = randomFrom(['India', 'Global']);
        const teamId = await generateUniqueTeamId();

        const teamPlayerIds = [];
        for (let p = 1; p <= PLAYERS_PER_TEAM; p += 1) {
            const username = `${RUN_TAG}_T${t}_P${p}`;
            const role = ROLES[(p - 1) % ROLES.length];

            const player = await Player.create(
                playerDoc({
                    username,
                    email: `${username.toLowerCase()}@demo.aegis.local`,
                    game,
                    role,
                    teamStatus: 'in a team',
                }),
            );

            createdTeamPlayers.push(player);
            teamPlayerIds.push(player._id);
        }

        const captainId = teamPlayerIds[0];

        const team = await Team.create({
            teamId,
            teamName: `${RUN_TAG}_TEAM_${t}`,
            teamTag: `D${t}M0`,
            captain: captainId,
            players: teamPlayerIds,
            primaryGame: game,
            region,
            country: region === 'India' ? 'India' : 'Global',
            status: 'active',
            lookingForPlayers: true,
            openRoles: [ROLES[t % ROLES.length], ROLES[(t + 2) % ROLES.length]],
            bio: `Sample recruiting team for ${RUN_TAG}`,
            profileVisibility: 'public',
            aegisRating: 1000 + t * 35,
        });

        createdTeams.push(team);

        await Player.updateMany(
            { _id: { $in: teamPlayerIds } },
            {
                $set: {
                    team: team._id,
                    teamStatus: 'in a team',
                },
            },
        );

        await LFPPost.create({
            team: team._id,
            description: `We are recruiting for ${game}. Need disciplined players for weekly practice and tournaments. [${RUN_TAG}]`,
            game,
            openRoles: team.openRoles,
            region: randomFrom(REGIONS),
            status: 'active',
        });
    }

    const summary = {
        runTag: RUN_TAG,
        freeAgents: createdFreeAgents.length,
        teams: createdTeams.length,
        teamPlayers: createdTeamPlayers.length,
        lftPosts: createdFreeAgents.length,
        lfpPosts: createdTeams.length,
        sampleFreeAgentUsernames: createdFreeAgents.slice(0, 4).map((p) => p.username),
        sampleTeamNames: createdTeams.map((t) => t.teamName),
    };

    console.log('\nSeed complete:');
    console.log(JSON.stringify(summary, null, 2));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

run()
    .catch(async (error) => {
        console.error('Seeding failed:', error.message || error);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    });
