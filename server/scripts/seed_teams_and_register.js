
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import Models
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';

const TOURNAMENT_ID = '699b4c24d859d3a229ee3d5f';
const TEAM_COUNT = 30;
const PLAYERS_PER_TEAM = 4;

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const tournament = await Tournament.findById(TOURNAMENT_ID);
        if (!tournament) {
            console.error('❌ Tournament not found');
            process.exit(1);
        }

        console.log(`🚀 Starting simulation for tournament: ${tournament.tournamentName}`);

        for (let i = 1; i <= TEAM_COUNT; i++) {
            const teamPlayers = [];

            // Create players for the team
            for (let j = 1; j <= PLAYERS_PER_TEAM; j++) {
                const username = `player_${i}_${j}_${Math.floor(Math.random() * 10000)}`;
                const email = `${username}@example.com`;

                const player = await Player.create({
                    username,
                    email,
                    gameIds: [{
                        inGameName: `${username}_IGN`,
                        characterId: `${Math.floor(100000000 + Math.random() * 900000000)}`,
                        isPrimary: true
                    }],
                    primaryGame: 'BGMI',
                    aegisRating: Math.floor(Math.random() * 2000),
                    teamStatus: 'in a team'
                });
                teamPlayers.push(player);
            }

            const captain = teamPlayers[0];
            const teamId = await Team.generateTeamId();
            const teamName = `Alpha Squad ${i}_${Math.floor(Math.random() * 1000)}`;

            // Create Team
            const team = await Team.create({
                teamId,
                teamName,
                captain: captain._id,
                players: teamPlayers.map(p => p._id),
                primaryGame: 'BGMI',
                region: 'India',
                status: 'active'
            });

            // Update players with team reference
            await Player.updateMany(
                { _id: { $in: teamPlayers.map(p => p._id) } },
                { team: team._id }
            );

            // Simulate registration from DetailedTournamentInfo page
            const firstPhase = tournament.phases && tournament.phases.length > 0 ? tournament.phases[0] : null;

            const registration = await Registration.create({
                tournament: TOURNAMENT_ID,
                team: team._id,
                status: tournament.isOpenForAll ? 'approved' : 'pending',
                qualifiedThrough: 'open_registration',
                currentStage: firstPhase?.name || 'Registered',
                phase: firstPhase?.name,
                approvedAt: tournament.isOpenForAll ? new Date() : undefined,
                roster: teamPlayers.map(player => {
                    return {
                        player: player._id,
                        inGameName: player.gameIds[0].inGameName
                    };
                })
            });

            // Update tournament stats (simulating post-save hook or manual update)
            await Tournament.updateOne(
                { _id: TOURNAMENT_ID },
                {
                    $inc: { 'slots.registered': 1 },
                    $set: { participatingTeamsCount: (tournament.participatingTeamsCount || 0) + i }
                }
            );

            console.log(`✅ [${i}/${TEAM_COUNT}] Team "${teamName}" registered with ${PLAYERS_PER_TEAM} players.`);
        }

        // Final update for participatingTeamsCount to match actual registrations
        const totalRegistrations = await Registration.countDocuments({
            tournament: TOURNAMENT_ID,
            status: { $in: ['approved', 'checked_in'] }
        });

        await Tournament.updateOne(
            { _id: TOURNAMENT_ID },
            { $set: { participatingTeamsCount: totalRegistrations } }
        );

        console.log('\n✨ Simulation complete! 30 teams created and registered.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during simulation:', error);
        process.exit(1);
    }
}

seedData();
