import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Player from '../models/player.model.js';

const KEEP_PLAYER_IDS = [
    '699b4a1ad859d3a229ee3cf8',
    '699b4cfad859d3a229ee3da8',
    '699b4e60919a5532a5c23108',
    '699b4fd7919a5532a5c23153',
];

async function deletePlayers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const playersToDelete = await Player.find({ _id: { $nin: KEEP_PLAYER_IDS } }).select('_id username email').lean();

        if (playersToDelete.length === 0) {
            console.log('ℹ️  No players to delete.');
            process.exit(0);
        }

        console.log(`\n🗑️  Players to delete (${playersToDelete.length}):`);
        playersToDelete.forEach(p => console.log(`   - ${p.username} (${p._id})`));

        console.log(`\n🔒 Keeping ${KEEP_PLAYER_IDS.length} players.`);

        const result = await Player.deleteMany({ _id: { $nin: KEEP_PLAYER_IDS } });
        console.log(`\n✅ Deleted ${result.deletedCount} player(s).`);
        console.log('\n🎉 Done.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

deletePlayers();
