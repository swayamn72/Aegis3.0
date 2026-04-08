import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Tournament from '../models/tournament.model.js';
import Match from '../models/match.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAP_ROTATION = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'];
const PLACEMENT_POINTS = {
    1: 10,
    2: 6,
    3: 5,
    4: 4,
    5: 3,
    6: 2,
    7: 1,
    8: 1,
};

function getPlacementPoints(position) {
    return PLACEMENT_POINTS[position] || 0;
}

function parseArgs(argv) {
    const args = {
        tournamentId: argv[2],
        phaseName: null,
        dryRun: false,
    };

    for (let i = 3; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--phase' && argv[i + 1]) {
            args.phaseName = argv[i + 1];
            i += 1;
        } else if (token === '--dry-run') {
            args.dryRun = true;
        }
    }

    return args;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function pickPhase(tournament, requestedPhaseName) {
    if (requestedPhaseName) {
        return tournament.phases.find((p) => p.name === requestedPhaseName) || null;
    }

    return (
        tournament.phases.find((p) => (p.groups || []).length > 0 && p.status !== 'completed') ||
        tournament.phases.find((p) => (p.groups || []).length > 0) ||
        null
    );
}

function countMatchesByGroup(matches, groupName) {
    return matches.filter((m) => (m.participatingGroups || []).includes(groupName)).length;
}

function buildKillVector(teamCount, forceWinnerKills = null) {
    const base = [8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 0];
    const kills = [];

    for (let i = 0; i < teamCount; i += 1) {
        const seed = i < base.length ? base[i] : 0;
        let value = seed + randomInt(-1, 1);
        if (i > 10 && value > 2) value = 2;
        if (value < 0) value = 0;
        kills.push(value);
    }

    if (forceWinnerKills != null) {
        kills[0] = forceWinnerKills;
    }

    let total = kills.reduce((s, k) => s + k, 0);
    const hardCap = Math.min(63, Math.max(48, teamCount * 4 - 2));

    while (total > hardCap) {
        for (let i = kills.length - 1; i >= 0 && total > hardCap; i -= 1) {
            if (kills[i] > 0) {
                kills[i] -= 1;
                total -= 1;
            }
        }
    }

    return kills;
}

function distributeKillsAcrossPlayers(playerIds, totalKills) {
    const ids = (playerIds || []).slice(0, 4);
    if (ids.length === 0 || totalKills <= 0) return [];

    const buckets = new Array(ids.length).fill(0);
    for (let i = 0; i < totalKills; i += 1) {
        buckets[randomInt(0, ids.length - 1)] += 1;
    }

    return ids
        .map((id, idx) => ({ player: id, kills: buckets[idx] }))
        .filter((b) => b.kills > 0);
}

async function run() {
    const { tournamentId, phaseName, dryRun } = parseArgs(process.argv);

    if (!tournamentId || !mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new Error('Usage: node scripts/seed_group_matches_for_testing.js <tournamentId> [--phase "Phase Name"] [--dry-run]');
    }

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in server/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findById(tournamentId).select('tournamentName status phases').lean();
    if (!tournament) {
        throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const phase = pickPhase(tournament, phaseName);
    if (!phase) {
        throw new Error('No phase with groups found for this tournament');
    }

    const groups = phase.groups || [];
    if (groups.length === 0) {
        throw new Error(`Phase "${phase.name}" has no groups`);
    }

    const existingPhaseMatches = await Match.find({
        tournament: tournamentId,
        tournamentPhase: phase.name,
        status: { $ne: 'cancelled' },
    })
        .select('matchNumber participatingGroups status')
        .lean();

    const maxMatchNumber = await Match.findOne({ tournament: tournamentId })
        .sort({ matchNumber: -1 })
        .select('matchNumber')
        .lean();
    let nextMatchNumber = (maxMatchNumber?.matchNumber || 0) + 1;

    const phaseRegs = await Registration.find({
        tournament: tournamentId,
        phase: phase.name,
        status: { $in: ['approved', 'checked_in'] },
    })
        .select('team group roster')
        .lean();

    const regByGroup = new Map();
    for (const reg of phaseRegs) {
        const g = reg.group || '';
        if (!regByGroup.has(g)) regByGroup.set(g, []);
        regByGroup.get(g).push(reg);
    }

    const allTeamIds = new Set();
    for (const g of groups) {
        (g.teams || []).forEach((id) => allTeamIds.add(id.toString()));
    }
    for (const reg of phaseRegs) {
        allTeamIds.add(reg.team.toString());
    }

    const teams = await Team.find({ _id: { $in: [...allTeamIds] } })
        .select('teamName players')
        .lean();
    const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

    const firstGroup = groups[0];
    const firstGroupName = firstGroup?.name || 'Group 1';
    const firstGroupTeamIds = new Set((firstGroup?.teams || []).map((id) => id.toString()));
    const stormTeam = teams.find((t) => firstGroupTeamIds.has(t._id.toString()) && t.teamName?.toLowerCase().includes('storm'));

    const matchesToInsert = [];
    const seededTeamIds = new Set();
    let groupIndex = 0;

    for (const group of groups) {
        groupIndex += 1;
        const groupName = group.name;
        const existingCount = countMatchesByGroup(existingPhaseMatches, groupName);

        if (existingCount >= 2) {
            console.log(`Skipping ${groupName}: already has ${existingCount} matches (target is max 2).`);
            continue;
        }

        const fromGroupTeams = (group.teams || []).map((id) => id.toString());
        const fromRegs = (regByGroup.get(groupName) || []).map((r) => r.team.toString());
        const teamIds = [...new Set([...fromGroupTeams, ...fromRegs])].filter((id) => teamMap.has(id));

        if (teamIds.length < 2) {
            console.log(`Skipping ${groupName}: not enough teams (${teamIds.length}).`);
            continue;
        }

        let orderedTeamIds = shuffle(teamIds);
        const isFirstGroup = groupName === firstGroupName;
        if (isFirstGroup && stormTeam) {
            orderedTeamIds = orderedTeamIds.filter((id) => id !== stormTeam._id.toString());
            orderedTeamIds.unshift(stormTeam._id.toString());
        }

        const forceWinnerKills = isFirstGroup && stormTeam ? randomInt(9, 11) : randomInt(7, 9);
        const killVector = buildKillVector(orderedTeamIds.length, forceWinnerKills);

        const results = orderedTeamIds.map((teamId, idx) => {
            const team = teamMap.get(teamId);
            const finalPosition = idx + 1;
            const killPoints = killVector[idx];
            const placementPoints = getPlacementPoints(finalPosition);
            const totalPoints = killPoints + placementPoints;

            const reg = (regByGroup.get(groupName) || []).find((r) => r.team.toString() === teamId);
            const rosterPlayerIds = (reg?.roster || [])
                .map((slot) => slot.player)
                .filter(Boolean);
            const fallbackPlayerIds = (team.players || []).slice(0, 4);
            const playerIds = rosterPlayerIds.length > 0 ? rosterPlayerIds : fallbackPlayerIds;
            const breakdown = distributeKillsAcrossPlayers(playerIds, killPoints);

            seededTeamIds.add(teamId);

            return {
                team: team._id,
                finalPosition,
                points: {
                    placementPoints,
                    killPoints,
                    totalPoints,
                },
                kills: {
                    total: killPoints,
                    breakdown,
                },
                chickenDinner: finalPosition === 1,
            };
        });

        let mostKillsPlayer = null;
        let mostKills = -1;
        for (const teamResult of results) {
            for (const row of teamResult.kills.breakdown) {
                if (row.kills > mostKills) {
                    mostKills = row.kills;
                    mostKillsPlayer = row.player;
                }
            }
        }

        const map = MAP_ROTATION[(groupIndex - 1) % MAP_ROTATION.length];

        matchesToInsert.push({
            tournament: tournamentId,
            tournamentPhase: phase.name,
            matchNumber: nextMatchNumber,
            scheduledStartTime: new Date(Date.now() - (groups.length - groupIndex + 1) * 30 * 60 * 1000),
            status: 'completed',
            map,
            participatingGroups: [groupName],
            results,
            matchStats: {
                totalKills: results.reduce((sum, r) => sum + (r.kills.total || 0), 0),
                mostKillsPlayer: mostKillsPlayer
                    ? { player: mostKillsPlayer, kills: Math.max(mostKills, 0) }
                    : undefined,
            },
            metadata: {
                manuallyEntered: true,
            },
            matchType: 'scheduled',
        });

        console.log(`Prepared seeded match #${nextMatchNumber} for ${groupName} (${orderedTeamIds.length} teams).`);
        nextMatchNumber += 1;
    }

    if (matchesToInsert.length === 0) {
        console.log('No matches seeded. All groups may already have 2 matches.');
        await mongoose.disconnect();
        return;
    }

    if (dryRun) {
        console.log(`Dry run complete. Would insert ${matchesToInsert.length} matches.`);
        await mongoose.disconnect();
        return;
    }

    const inserted = await Match.insertMany(matchesToInsert, { ordered: true });

    await Tournament.updateOne(
        { _id: tournamentId, 'phases.name': phase.name },
        {
            $push: {
                'phases.$.matches': { $each: inserted.map((m) => m._id) },
            },
            $set: {
                'phases.$.status': 'in_progress',
            },
        }
    );

    const phaseStanding = await PhaseStanding.getOrCreate(tournamentId, phase.name);
    await phaseStanding.recalculate();

    console.log(`Inserted ${inserted.length} matches into phase "${phase.name}" for tournament "${tournament.tournamentName}".`);
    console.log(`Seeded teams involved: ${seededTeamIds.size}`);
    if (stormTeam) {
        console.log(`Team Storm forced to top in ${firstGroupName}: ${stormTeam.teamName}`);
    } else {
        console.log('No team with "storm" in name was found inside Group 1; skipped force-top rule.');
    }

    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error('Seed script failed:', error.message || error);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});
