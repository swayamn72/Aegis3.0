import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import LFTPost from '../models/lftPost.model.js';
import LFPPost from '../models/lfpPost.model.js';
import TeamApplication from '../models/teamApplication.model.js';

/**
 * Migration script to update role enums from lowercase to title case
 * 
 * OLD VALUES: ['assaulter', 'igl', 'support', 'filter', 'sniper', 'fragger']
 * NEW VALUES: ['Assaulter', 'IGL', 'Support', 'Fragger', 'Sniper']
 * 
 * This script updates existing data to match the new enum values.
 */

const roleMapping = {
    'assaulter': 'Assaulter',
    'igl': 'IGL',
    'support': 'Support',
    'filter': 'Fragger', // Fixing typo
    'sniper': 'Sniper',
    'fragger': 'Fragger'
};

async function migrateRoles() {
    try {
        console.log('Connecting to database...');
        await connectDB();

        // 1. Migrate Player.inGameRole
        console.log('\n1. Migrating Player.inGameRole...');
        const players = await Player.find({}).select('inGameRole');
        let playerUpdates = 0;

        for (const player of players) {
            if (player.inGameRole && player.inGameRole.length > 0) {
                const updatedRoles = player.inGameRole.map(role =>
                    roleMapping[role.toLowerCase()] || role
                );

                if (JSON.stringify(updatedRoles) !== JSON.stringify(player.inGameRole)) {
                    player.inGameRole = updatedRoles;
                    await player.save();
                    playerUpdates++;
                }
            }
        }
        console.log(`✓ Updated ${playerUpdates} players`);

        // 2. Migrate Team.openRoles
        console.log('\n2. Migrating Team.openRoles...');
        const teams = await Team.find({}).select('openRoles');
        let teamUpdates = 0;

        for (const team of teams) {
            if (team.openRoles && team.openRoles.length > 0) {
                const updatedRoles = team.openRoles.map(role =>
                    roleMapping[role.toLowerCase()] || role
                );

                if (JSON.stringify(updatedRoles) !== JSON.stringify(team.openRoles)) {
                    team.openRoles = updatedRoles;
                    await team.save();
                    teamUpdates++;
                }
            }
        }
        console.log(`✓ Updated ${teamUpdates} teams`);

        // 3. Migrate LFTPost.roles
        console.log('\n3. Migrating LFTPost.roles...');
        const lftPosts = await LFTPost.find({}).select('roles');
        let lftUpdates = 0;

        for (const post of lftPosts) {
            if (post.roles && post.roles.length > 0) {
                const updatedRoles = post.roles.map(role =>
                    roleMapping[role.toLowerCase()] || role
                );

                if (JSON.stringify(updatedRoles) !== JSON.stringify(post.roles)) {
                    post.roles = updatedRoles;
                    await post.save();
                    lftUpdates++;
                }
            }
        }
        console.log(`✓ Updated ${lftUpdates} LFT posts`);

        // 4. Migrate LFPPost.openRoles
        console.log('\n4. Migrating LFPPost.openRoles...');
        const lfpPosts = await LFPPost.find({}).select('openRoles');
        let lfpUpdates = 0;

        for (const post of lfpPosts) {
            if (post.openRoles && post.openRoles.length > 0) {
                const updatedRoles = post.openRoles.map(role =>
                    roleMapping[role.toLowerCase()] || role
                );

                if (JSON.stringify(updatedRoles) !== JSON.stringify(post.openRoles)) {
                    post.openRoles = updatedRoles;
                    await post.save();
                    lfpUpdates++;
                }
            }
        }
        console.log(`✓ Updated ${lfpUpdates} LFP posts`);

        // 5. Migrate TeamApplication.appliedRoles
        console.log('\n5. Migrating TeamApplication.appliedRoles...');
        const applications = await TeamApplication.find({}).select('appliedRoles');
        let appUpdates = 0;

        for (const app of applications) {
            if (app.appliedRoles && app.appliedRoles.length > 0) {
                const updatedRoles = app.appliedRoles.map(role =>
                    roleMapping[role.toLowerCase()] || role
                );

                if (JSON.stringify(updatedRoles) !== JSON.stringify(app.appliedRoles)) {
                    app.appliedRoles = updatedRoles;
                    await app.save();
                    appUpdates++;
                }
            }
        }
        console.log(`✓ Updated ${appUpdates} team applications`);

        console.log('\n' + '='.repeat(50));
        console.log('MIGRATION COMPLETE');
        console.log('='.repeat(50));
        console.log(`Total Updates:`);
        console.log(`  Players: ${playerUpdates}`);
        console.log(`  Teams: ${teamUpdates}`);
        console.log(`  LFT Posts: ${lftUpdates}`);
        console.log(`  LFP Posts: ${lfpUpdates}`);
        console.log(`  Applications: ${appUpdates}`);
        console.log('='.repeat(50));

        await mongoose.disconnect();
        console.log('\n✓ Database disconnected');
    } catch (error) {
        console.error('\n❌ Migration Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

migrateRoles();
