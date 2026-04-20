import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import Match from '../models/match.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAPS = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'];

function parseArgs(argv) {
    const args = {
        teams: 16,
        prefix: 'UI Check',
    };

    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];

        if (token === '--teams' && argv[i + 1]) {
            const parsed = Number(argv[i + 1]);
            if (Number.isFinite(parsed) && parsed >= 8 && parsed <= 64) {
                args.teams = Math.floor(parsed);
            }
            i += 1;
        } else if (token === '--prefix' && argv[i + 1]) {
            args.prefix = String(argv[i + 1]).trim() || args.prefix;
            i += 1;
        }
    }

    return args;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function ensureTeams(targetCount, seedKey) {
    const existingTeams = await Team.find({
        primaryGame: 'BGMI',
        captain: { $ne: null },
    })
        .select('_id teamName captain players')
        .limit(targetCount)
        .lean();

    const teams = [...existingTeams];
    const need = targetCount - teams.length;

    if (need <= 0) return teams;

    console.log(`Only ${teams.length} BGMI teams found, creating ${need} sample teams...`);

    for (let i = 0; i < need; i += 1) {
        const teamSeed = `${seedKey}_${i + 1}`;
        const playerIds = [];

        for (let slot = 1; slot <= 4; slot += 1) {
            const username = `ui_${teamSeed}_p${slot}_${Date.now()}_${randomInt(1000, 9999)}`;
            const email = `${username}@aegis-sample.local`;
            const characterId = `${randomInt(100000000, 999999999)}`;

            const player = await Player.create({
                username,
                email,
                gameIds: [
                    {
                        inGameName: `IGN_${teamSeed}_${slot}`,
                        characterId,
                        isPrimary: true,
                    },
                ],
                primaryGame: 'BGMI',
                teamStatus: 'in a team',
                verified: true,
                isEmailVerified: true,
            });

            playerIds.push(player._id);
        }

        const captain = playerIds[0];
        const teamId = await Team.generateTeamId();
        const teamName = `UI Team ${teamSeed}`;

        const team = await Team.create({
            teamId,
            teamName,
            teamTag: `U${String(i + 1).padStart(2, '0')}`,
            captain,
            players: playerIds,
            primaryGame: 'BGMI',
            region: 'India',
            status: 'active',
            profileVisibility: 'public',
        });

        await Player.updateMany({ _id: { $in: playerIds } }, { $set: { team: team._id } });

        teams.push({
            _id: team._id,
            teamName: team.teamName,
            captain: team.captain,
            players: team.players,
        });
    }

    return teams;
}

function buildPhases(teamIds, now) {
    const shuffled = shuffle(teamIds);
    const qualifiersTeams = shuffled;
    const quarterTeams = shuffled.slice(0, Math.max(8, Math.floor(shuffled.length * 0.75)));
    const semiTeams = shuffled.slice(0, Math.max(6, Math.floor(shuffled.length * 0.5)));

    const day = 24 * 60 * 60 * 1000;

    return [
        {
            name: 'Qualifiers',
            type: 'qualifiers',
            startDate: new Date(now.getTime() - 2 * day),
            endDate: new Date(now.getTime() + 1 * day),
            status: 'in_progress',
            teams: qualifiersTeams,
            groups: [
                {
                    name: 'Group A',
                    teams: qualifiersTeams.slice(0, Math.ceil(qualifiersTeams.length / 2)),
                    isLocked: true,
                },
                {
                    name: 'Group B',
                    teams: qualifiersTeams.slice(Math.ceil(qualifiersTeams.length / 2)),
                    isLocked: true,
                },
            ],
        },
        {
            name: 'Quarter Finals',
            type: 'qualifiers',
            startDate: new Date(now.getTime() - 12 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 12 * 60 * 60 * 1000),
            status: 'in_progress',
            teams: quarterTeams,
            groups: [
                {
                    name: 'QF Group 1',
                    teams: quarterTeams.slice(0, Math.ceil(quarterTeams.length / 2)),
                    isLocked: true,
                },
                {
                    name: 'QF Group 2',
                    teams: quarterTeams.slice(Math.ceil(quarterTeams.length / 2)),
                    isLocked: true,
                },
            ],
        },
        {
            name: 'Semi Finals',
            type: 'final_stage',
            startDate: new Date(now.getTime() - 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 2 * day),
            status: 'in_progress',
            teams: semiTeams,
            groups: [
                {
                    name: 'Semi Lobby',
                    teams: semiTeams,
                    isLocked: true,
                },
            ],
        },
    ];
}

function makeResults(teamIds) {
    return teamIds.map((teamId) => ({
        team: teamId,
        finalPosition: null,
        points: {
            placementPoints: 0,
            killPoints: 0,
            totalPoints: 0,
        },
        kills: {
            total: 0,
            breakdown: [],
        },
        chickenDinner: false,
    }));
}

async function run() {
    const args = parseArgs(process.argv);

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in server/.env');
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 12);
    const seedKey = `${stamp}${randomInt(100, 999)}`;

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const teams = await ensureTeams(args.teams, seedKey);
    if (teams.length < 8) {
        throw new Error(`Need at least 8 teams, found ${teams.length}`);
    }

    const selectedTeams = teams.slice(0, args.teams);
    const selectedTeamIds = selectedTeams.map((t) => t._id);

    const phases = buildPhases(selectedTeamIds, now);

    const tournamentName = `${args.prefix} BGMI Ongoing ${stamp}`;

    const tournament = await Tournament.create({
        tournamentName,
        shortName: `UIC-${stamp.slice(-4)}`,
        gameTitle: 'BGMI',
        tier: 'Community',
        region: 'India',
        organizer: {
            name: 'Aegis UI Seeder',
            contactEmail: 'seed@aegis.local',
        },
        isOpenForAll: true,
        requiresApproval: false,
        announcementDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        registrationStartDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        registrationEndDate: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'in_progress',
        format: 'Battle Royale Points System',
        formatDetails: 'Sample ongoing bracket for frontend navigation and live-state QA.',
        slots: {
            total: selectedTeams.length,
            invited: 0,
            openRegistrations: selectedTeams.length,
            registered: selectedTeams.length,
        },
        participatingTeamsCount: selectedTeams.length,
        phases,
        prizePool: {
            total: 100000,
            currency: 'INR',
            distribution: [
                { position: '1st', amount: 50000 },
                { position: '2nd', amount: 30000 },
                { position: '3rd', amount: 20000 },
            ],
        },
        description: 'Auto-seeded tournament for frontend testing (ongoing through semi finals).',
        gameSettings: {
            gameMode: 'TPP Squad',
            maps: MAPS,
        },
        visibility: 'public',
        featured: true,
        verified: true,
        tags: ['sample', 'ui-test', 'ongoing', 'semi-finals'],
        statistics: {
            totalMatches: 5,
            totalParticipatingTeams: selectedTeams.length,
        },
    });

    const registrations = selectedTeams.map((team, idx) => ({
        tournament: tournament._id,
        team: team._id,
        status: 'approved',
        qualifiedThrough: 'open_registration',
        currentStage: idx < phases[2].teams.length ? 'Semi Finals' : 'Quarter Finals',
        phase: idx < phases[2].teams.length ? 'Semi Finals' : 'Quarter Finals',
        group: idx < phases[2].teams.length ? 'Semi Lobby' : idx % 2 === 0 ? 'QF Group 1' : 'QF Group 2',
        approvedAt: now,
        roster: (team.players || []).slice(0, 4).map((playerId, slot) => ({
            player: playerId,
            inGameName: `Slot ${slot + 1}`,
        })),
    }));

    await Registration.insertMany(registrations, { ordered: false });

    const qfTeams = phases.find((p) => p.name === 'Quarter Finals')?.teams || selectedTeamIds;
    const semiTeams = phases.find((p) => p.name === 'Semi Finals')?.teams || selectedTeamIds;

    const matchBlueprints = [
        {
            tournamentPhase: 'Quarter Finals',
            map: 'Sanhok',
            participants: qfTeams,
            groups: ['QF Group 1'],
            startOffsetMinutes: -40,
        },
        {
            tournamentPhase: 'Quarter Finals',
            map: 'Rondo',
            participants: qfTeams,
            groups: ['QF Group 2'],
            startOffsetMinutes: -20,
        },
        {
            tournamentPhase: 'Semi Finals',
            map: 'Erangel',
            participants: semiTeams,
            groups: ['Semi Lobby'],
            startOffsetMinutes: -10,
        },
        {
            tournamentPhase: 'Semi Finals',
            map: 'Miramar',
            participants: semiTeams,
            groups: ['Semi Lobby'],
            startOffsetMinutes: 5,
        },
        {
            tournamentPhase: 'Semi Finals',
            map: 'Vikendi',
            participants: semiTeams,
            groups: ['Semi Lobby'],
            startOffsetMinutes: 25,
        },
    ];

    const createdMatches = [];

    for (let i = 0; i < matchBlueprints.length; i += 1) {
        const b = matchBlueprints[i];
        const match = await Match.create({
            matchNumber: i + 1,
            tournament: tournament._id,
            tournamentPhase: b.tournamentPhase,
            scheduledStartTime: new Date(now.getTime() + b.startOffsetMinutes * 60 * 1000),
            status: 'in_progress',
            map: b.map,
            participatingGroups: b.groups,
            results: makeResults(b.participants),
            matchStats: {
                totalKills: 0,
            },
            streamUrls: [
                {
                    platform: 'YouTube',
                    url: `https://youtube.com/live/${seedKey}${i + 1}`,
                    language: 'English',
                    isMain: i === 0,
                },
            ],
            metadata: {
                manuallyEntered: true,
            },
            matchType: 'scheduled',
            visibility: 'public',
        });

        createdMatches.push(match);
    }

    const matchIdsByPhase = {
        'Qualifiers': [],
        'Quarter Finals': createdMatches
            .filter((m) => m.tournamentPhase === 'Quarter Finals')
            .map((m) => m._id),
        'Semi Finals': createdMatches
            .filter((m) => m.tournamentPhase === 'Semi Finals')
            .map((m) => m._id),
    };

    const updatedPhases = tournament.phases.map((phase) => ({
        ...phase.toObject(),
        matches: matchIdsByPhase[phase.name] || [],
    }));

    await Tournament.updateOne(
        { _id: tournament._id },
        {
            $set: {
                phases: updatedPhases,
                'statistics.totalMatches': createdMatches.length,
            },
        }
    );

    console.log('');
    console.log('Sample ongoing tournament created successfully.');
    console.log(`Tournament ID: ${tournament._id}`);
    console.log(`Tournament Name: ${tournament.tournamentName}`);
    console.log(`Teams Used: ${selectedTeams.length}`);
    console.log(`Matches Created: ${createdMatches.length}`);
    console.log(`Maps Included: ${MAPS.join(', ')}`);

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('Seed script failed:', err.message || err);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});
