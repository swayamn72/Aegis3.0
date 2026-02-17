import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';

const KEEP_TEAM_ID = '6992e7b47535a125fdc1d0f4';

async function main() {
    try {
        console.log('🗑️  Starting cleanup script...\n');

        console.log('📡 Connecting to database...');
        await connectDB();
        console.log('✓ Connected to database\n');

        // 1. Verify the team to keep exists
        console.log('🔍 Verifying team to keep...');
        const teamToKeep = await Team.findById(KEEP_TEAM_ID);
        if (!teamToKeep) {
            throw new Error(`❌ Team with ID ${KEEP_TEAM_ID} not found!`);
        }
        console.log(`✓ Found team to keep: ${teamToKeep.teamName} (${teamToKeep.teamId})\n`);

        // 2. Find all teams except the one to keep
        console.log('🔍 Finding teams to delete...');
        const teamsToDelete = await Team.find({ _id: { $ne: KEEP_TEAM_ID } });
        const teamIdsToDelete = teamsToDelete.map(t => t._id);
        console.log(`   Found ${teamsToDelete.length} teams to delete\n`);

        if (teamsToDelete.length === 0) {
            console.log('✨ No teams to delete. Script complete!');
            await mongoose.disconnect();
            process.exit(0);
        }

        // 3. Find and update/delete players from deleted teams
        console.log('👥 Handling players from deleted teams...');
        const playersToUpdate = await Player.find({ team: { $in: teamIdsToDelete } });
        console.log(`   Found ${playersToUpdate.length} players to update`);

        // Option 1: Delete players (uncomment this if you want to delete)
        // const deletedPlayers = await Player.deleteMany({ team: { $in: teamIdsToDelete } });
        // console.log(`   ✓ Deleted ${deletedPlayers.deletedCount} players\n`);

        // Option 2: Just remove team reference (keeping players in DB)
        const updatedPlayers = await Player.updateMany(
            { team: { $in: teamIdsToDelete } },
            {
                $set: { team: null, teamStatus: 'looking for a team' },
                $pull: { previousTeams: { team: { $in: teamIdsToDelete } } }
            }
        );
        console.log(`   ✓ Updated ${updatedPlayers.modifiedCount} players (removed team references)\n`);

        // 4. Delete registrations for deleted teams
        console.log('📝 Deleting registrations...');
        const deletedRegistrations = await Registration.deleteMany({
            team: { $in: teamIdsToDelete }
        });
        console.log(`   ✓ Deleted ${deletedRegistrations.deletedCount} registrations\n`);

        // 5. Remove deleted teams from tournament phases
        console.log('🏆 Updating tournaments...');
        const tournaments = await Tournament.find({
            $or: [
                { 'phases.teams': { $in: teamIdsToDelete } },
                { 'finalStandings.team': { $in: teamIdsToDelete } }
            ]
        });

        let updatedTournaments = 0;
        for (const tournament of tournaments) {
            let modified = false;

            // Remove from phases
            if (tournament.phases && tournament.phases.length > 0) {
                for (const phase of tournament.phases) {
                    if (phase.teams && phase.teams.length > 0) {
                        const originalLength = phase.teams.length;
                        phase.teams = phase.teams.filter(
                            teamId => !teamIdsToDelete.some(id => id.equals(teamId))
                        );
                        if (phase.teams.length !== originalLength) {
                            modified = true;
                        }
                    }

                    // Remove from groups within phases
                    if (phase.groups && phase.groups.length > 0) {
                        for (const group of phase.groups) {
                            if (group.teams && group.teams.length > 0) {
                                const originalLength = group.teams.length;
                                group.teams = group.teams.filter(
                                    teamId => !teamIdsToDelete.some(id => id.equals(teamId))
                                );
                                if (group.teams.length !== originalLength) {
                                    modified = true;
                                }
                            }
                        }
                    }
                }
            }

            // Remove from final standings
            if (tournament.finalStandings && tournament.finalStandings.length > 0) {
                const originalLength = tournament.finalStandings.length;
                tournament.finalStandings = tournament.finalStandings.filter(
                    standing => !teamIdsToDelete.some(id => id.equals(standing.team))
                );
                if (tournament.finalStandings.length !== originalLength) {
                    modified = true;
                }
            }

            // Update participating teams count
            if (modified) {
                const activeRegistrations = await Registration.countDocuments({
                    tournament: tournament._id,
                    status: { $in: ['approved', 'checked_in'] }
                });
                tournament.participatingTeamsCount = activeRegistrations;
                await tournament.save();
                updatedTournaments++;
            }
        }
        console.log(`   ✓ Updated ${updatedTournaments} tournaments\n`);

        // 6. Delete the teams
        console.log('🗑️  Deleting teams...');
        const deletedTeams = await Team.deleteMany({ _id: { $in: teamIdsToDelete } });
        console.log(`   ✓ Deleted ${deletedTeams.deletedCount} teams\n`);

        // Summary
        console.log('✨ Cleanup Summary:');
        console.log(`   - Teams kept: 1 (${teamToKeep.teamName})`);
        console.log(`   - Teams deleted: ${deletedTeams.deletedCount}`);
        console.log(`   - Players updated: ${updatedPlayers.modifiedCount}`);
        console.log(`   - Registrations deleted: ${deletedRegistrations.deletedCount}`);
        console.log(`   - Tournaments updated: ${updatedTournaments}\n`);

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
