import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Post from '../models/post.model.js';

const KEEP_PLAYER_IDS = [
    '6992e6dd7535a125fdc1d0d1',
    '6992e7407535a125fdc1d0e3',
    '6992e82d7535a125fdc1d12e'
];

async function main() {
    try {
        console.log('🗑️  Starting player cleanup script...\n');

        console.log('📡 Connecting to database...');
        await connectDB();
        console.log('✓ Connected to database\n');

        // 1. Verify the players to keep exist
        console.log('🔍 Verifying players to keep...');
        const playersToKeep = await Player.find({ _id: { $in: KEEP_PLAYER_IDS } });

        if (playersToKeep.length !== KEEP_PLAYER_IDS.length) {
            console.warn(`⚠️  Warning: Only found ${playersToKeep.length} out of ${KEEP_PLAYER_IDS.length} players`);
            playersToKeep.forEach(p => {
                console.log(`   ✓ Found: ${p.username} (${p._id})`);
            });

            const foundIds = playersToKeep.map(p => p._id.toString());
            const missingIds = KEEP_PLAYER_IDS.filter(id => !foundIds.includes(id));
            if (missingIds.length > 0) {
                console.log(`   ❌ Missing players: ${missingIds.join(', ')}`);
            }
        } else {
            playersToKeep.forEach(p => {
                console.log(`   ✓ ${p.username} (${p._id})`);
            });
        }
        console.log();

        // 2. Find all players except the ones to keep
        console.log('🔍 Finding players to delete...');
        const playersToDelete = await Player.find({ _id: { $nin: KEEP_PLAYER_IDS } });
        const playerIdsToDelete = playersToDelete.map(p => p._id);
        console.log(`   Found ${playersToDelete.length} players to delete\n`);

        if (playersToDelete.length === 0) {
            console.log('✨ No players to delete. Script complete!');
            await mongoose.disconnect();
            process.exit(0);
        }

        // 3. Remove players from teams
        console.log('🏆 Updating teams...');
        const teamsWithDeletedPlayers = await Team.find({
            $or: [
                { captain: { $in: playerIdsToDelete } },
                { players: { $in: playerIdsToDelete } }
            ]
        });

        let updatedTeams = 0;
        let deletedTeams = 0;

        for (const team of teamsWithDeletedPlayers) {
            // Remove deleted players from team.players array
            const originalPlayerCount = team.players.length;
            team.players = team.players.filter(
                playerId => !playerIdsToDelete.some(id => id.equals(playerId))
            );

            // Check if captain is being deleted
            const captainIsDeleted = playerIdsToDelete.some(id => id.equals(team.captain));

            // If team has no players left or captain is deleted and no replacement, delete the team
            if (team.players.length === 0 || (captainIsDeleted && team.players.length === 0)) {
                await Team.deleteOne({ _id: team._id });
                deletedTeams++;
            } else {
                // If captain is deleted but there are still players, assign new captain
                if (captainIsDeleted && team.players.length > 0) {
                    team.captain = team.players[0];
                    console.log(`   ℹ️  Team "${team.teamName}": Assigned new captain`);
                }
                await team.save();
                updatedTeams++;
            }
        }
        console.log(`   ✓ Updated ${updatedTeams} teams`);
        console.log(`   ✓ Deleted ${deletedTeams} teams (no players remaining)\n`);

        // 4. Update registrations - remove deleted players from rosters
        console.log('📝 Updating registrations...');
        const registrations = await Registration.find({
            'roster.player': { $in: playerIdsToDelete }
        });

        let updatedRegistrations = 0;
        for (const registration of registrations) {
            const originalRosterSize = registration.roster.length;
            registration.roster = registration.roster.filter(
                r => !playerIdsToDelete.some(id => id.equals(r.player))
            );

            if (registration.roster.length !== originalRosterSize) {
                await registration.save();
                updatedRegistrations++;
            }
        }
        console.log(`   ✓ Updated ${updatedRegistrations} registrations\n`);

        // 5. Delete posts by deleted players
        console.log('📰 Deleting posts...');
        const deletedPosts = await Post.deleteMany({
            author: { $in: playerIdsToDelete }
        });
        console.log(`   ✓ Deleted ${deletedPosts.deletedCount} posts\n`);

        // 6. Remove connection references from remaining players
        console.log('🔗 Cleaning up connections...');
        const connectionsUpdated = await Player.updateMany(
            {
                $or: [
                    { connections: { $in: playerIdsToDelete } },
                    { sentRequests: { $in: playerIdsToDelete } },
                    { receivedRequests: { $in: playerIdsToDelete } }
                ]
            },
            {
                $pull: {
                    connections: { $in: playerIdsToDelete },
                    sentRequests: { $in: playerIdsToDelete },
                    receivedRequests: { $in: playerIdsToDelete }
                }
            }
        );
        console.log(`   ✓ Updated ${connectionsUpdated.modifiedCount} players' connections\n`);

        // 7. Delete the players
        console.log('🗑️  Deleting players...');
        const deletedPlayers = await Player.deleteMany({ _id: { $in: playerIdsToDelete } });
        console.log(`   ✓ Deleted ${deletedPlayers.deletedCount} players\n`);

        // Summary
        console.log('✨ Cleanup Summary:');
        console.log(`   - Players kept: ${playersToKeep.length}`);
        playersToKeep.forEach(p => {
            console.log(`     • ${p.username} (${p.email})`);
        });
        console.log(`   - Players deleted: ${deletedPlayers.deletedCount}`);
        console.log(`   - Teams updated: ${updatedTeams}`);
        console.log(`   - Teams deleted: ${deletedTeams}`);
        console.log(`   - Registrations updated: ${updatedRegistrations}`);
        console.log(`   - Posts deleted: ${deletedPosts.deletedCount}`);
        console.log(`   - Connections cleaned: ${connectionsUpdated.modifiedCount} players\n`);

        await mongoose.disconnect();
        console.log('✅ Cleanup completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
