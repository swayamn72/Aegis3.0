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

const PREFIX = process.argv[2] || 'TEAMUP_DEMO_';

function buildStartsWithRegex(prefix) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}`);
}

async function run() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not configured in server/.env');
    }

    const startsWith = buildStartsWithRegex(PREFIX);

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const players = await Player.find({ username: startsWith }).select('_id username').lean();
    const teams = await Team.find({ teamName: startsWith }).select('_id teamName').lean();

    const playerIds = players.map((p) => p._id);
    const teamIds = teams.map((t) => t._id);

    const lftResult = playerIds.length > 0
        ? await LFTPost.deleteMany({ player: { $in: playerIds } })
        : { deletedCount: 0 };

    const lfpResult = teamIds.length > 0
        ? await LFPPost.deleteMany({ team: { $in: teamIds } })
        : { deletedCount: 0 };

    const teamResult = teamIds.length > 0
        ? await Team.deleteMany({ _id: { $in: teamIds } })
        : { deletedCount: 0 };

    const playerResult = playerIds.length > 0
        ? await Player.deleteMany({ _id: { $in: playerIds } })
        : { deletedCount: 0 };

    console.log('\nCleanup complete:');
    console.log(
        JSON.stringify(
            {
                prefix: PREFIX,
                matchedPlayers: players.length,
                matchedTeams: teams.length,
                deleted: {
                    lftPosts: lftResult.deletedCount || 0,
                    lfpPosts: lfpResult.deletedCount || 0,
                    teams: teamResult.deletedCount || 0,
                    players: playerResult.deletedCount || 0,
                },
            },
            null,
            2,
        ),
    );

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

run()
    .catch(async (error) => {
        console.error('Cleanup failed:', error.message || error);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    });
