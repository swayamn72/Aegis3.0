import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Team from '../models/team.model.js';

/**
 * Migration script to add unique 6-digit teamId to all existing teams
 * Run this script once after deploying the teamId field to the Team model
 */
async function migrateTeams() {
    try {
        await connectDB();
        console.log('Connected to database');

        // Find all teams that don't have a teamId
        const teamsWithoutId = await Team.find({
            $or: [
                { teamId: { $exists: false } },
                { teamId: null },
                { teamId: '' }
            ]
        });

        if (teamsWithoutId.length === 0) {
            console.log('✅ All teams already have teamId assigned');
            await mongoose.disconnect();
            return;
        }

        console.log(`Found ${teamsWithoutId.length} teams without teamId`);
        console.log('Starting migration...\n');

        let successCount = 0;
        let errorCount = 0;

        for (const team of teamsWithoutId) {
            try {
                // Generate unique 6-digit teamId
                const teamId = await Team.generateTeamId();

                // Update the team
                team.teamId = teamId;
                await team.save();

                successCount++;
                console.log(`✅ [${successCount}/${teamsWithoutId.length}] Team "${team.teamName}" assigned ID: ${teamId}`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Failed to update team "${team.teamName}":`, error.message);
            }
        }

        console.log('\n=================================');
        console.log('Migration completed!');
        console.log(`✅ Successfully updated: ${successCount} teams`);
        if (errorCount > 0) {
            console.log(`❌ Failed to update: ${errorCount} teams`);
        }
        console.log('=================================\n');

        await mongoose.disconnect();
        console.log('Disconnected from database');
    } catch (error) {
        console.error('Migration error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the migration
migrateTeams();
