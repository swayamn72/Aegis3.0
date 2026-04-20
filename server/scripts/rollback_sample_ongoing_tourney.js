import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Tournament from '../models/tournament.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseArgs(argv) {
    const args = {
        tournamentId: null,
    };

    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--tournamentId' && argv[i + 1]) {
            args.tournamentId = argv[i + 1];
            i += 1;
        }
    }

    return args;
}

async function rollbackTournament(tournamentId) {
    const tournament = await Tournament.findById(tournamentId).lean();
    if (!tournament) {
        console.log(`Tournament not found: ${tournamentId}`);
        return;
    }

    const registrations = await Registration.find({ tournament: tournamentId })
        .select('team')
        .lean();

    const teamIds = [...new Set(registrations.map((r) => String(r.team)))];

    const deletedMatches = await Match.deleteMany({ tournament: tournamentId });
    const deletedRegistrations = await Registration.deleteMany({ tournament: tournamentId });
    await Tournament.deleteOne({ _id: tournamentId });

    let deletedTeams = 0;
    let deletedPlayers = 0;

    for (const teamId of teamIds) {
        const team = await Team.findById(teamId).select('teamName players').lean();
        if (!team) continue;

        if (!/^UI Team\s/.test(team.teamName || '')) {
            continue;
        }

        const remainingRegs = await Registration.countDocuments({ team: team._id });
        if (remainingRegs > 0) {
            continue;
        }

        const playerIds = (team.players || []).map((p) => p);
        await Team.deleteOne({ _id: team._id });
        deletedTeams += 1;

        const removedPlayers = await Player.deleteMany({
            _id: { $in: playerIds },
            username: /^ui_/,
        });

        deletedPlayers += removedPlayers.deletedCount || 0;
    }

    console.log('Rollback complete.');
    console.log(`Deleted tournament: ${tournamentId}`);
    console.log(`Deleted matches: ${deletedMatches.deletedCount || 0}`);
    console.log(`Deleted registrations: ${deletedRegistrations.deletedCount || 0}`);
    console.log(`Deleted sample teams: ${deletedTeams}`);
    console.log(`Deleted sample players: ${deletedPlayers}`);
}

async function run() {
    const { tournamentId } = parseArgs(process.argv);

    if (!tournamentId || !mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new Error('Usage: node scripts/rollback_sample_ongoing_tourney.js --tournamentId <id>');
    }

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in server/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    await rollbackTournament(tournamentId);

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('Rollback failed:', err.message || err);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});
