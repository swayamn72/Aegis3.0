import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import Registration from '../models/registration.model.js';

const KEEP_TEAM_ID = '699b4b11d859d3a229ee3d19';

async function deleteTeams() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find all teams to be deleted
        const teamsToDelete = await Team.find({ _id: { $ne: KEEP_TEAM_ID } }).select('_id teamName').lean();

        if (teamsToDelete.length === 0) {
            console.log('ℹ️  No teams to delete.');
            process.exit(0);
        }

        const teamIdsToDelete = teamsToDelete.map(t => t._id);

        console.log(`\n🗑️  Teams to delete (${teamsToDelete.length}):`);
        teamsToDelete.forEach(t => console.log(`   - ${t.teamName} (${t._id})`));
        console.log(`\n🔒 Keeping team: ${KEEP_TEAM_ID}`);

        // Delete registrations linked to those teams
        const regResult = await Registration.deleteMany({ team: { $in: teamIdsToDelete } });
        console.log(`\n✅ Deleted ${regResult.deletedCount} registration(s)`);

        // Remove team references from players (set team field to null)
        const playerResult = await Player.updateMany(
            { team: { $in: teamIdsToDelete } },
            { $unset: { team: '' } }
        );
        console.log(`✅ Cleared team reference from ${playerResult.modifiedCount} player(s)`);

        // Delete the teams
        const teamResult = await Team.deleteMany({ _id: { $in: teamIdsToDelete } });
        console.log(`✅ Deleted ${teamResult.deletedCount} team(s)`);

        console.log('\n🎉 Done.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

deleteTeams();
