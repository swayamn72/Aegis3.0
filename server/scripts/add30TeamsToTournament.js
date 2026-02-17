import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';
import bcrypt from 'bcrypt';

const TOURNAMENT_ID = '6992e4337535a125fdc1d051';

// Sample Indian names
const firstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advait', 'Dhruv', 'Kabir', 'Shivansh', 'Ritvik', 'Ansh',
    'Reyansh', 'Daksh', 'Kiaan', 'Yash', 'Aarush', 'Rudra', 'Ved', 'Veer', 'Aayansh', 'Raghav',
    'Rohan', 'Karan', 'Harsh', 'Dev', 'Rishi', 'Tanish', 'Om', 'Siddharth', 'Samar', 'Naveen'
];

const lastNames = [
    'Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Reddy', 'Rao', 'Joshi', 'Mehta',
    'Nair', 'Pillai', 'Iyer', 'Das', 'Bose', 'Ghosh', 'Roy', 'Sinha', 'Saxena', 'Pandey',
    'Mishra', 'Agarwal', 'Desai', 'Kulkarni', 'Shetty', 'Menon', 'Bhat', 'Chopra', 'Malhotra', 'Kapoor'
];

const teamNames = [
    'Phoenix Riders', 'Shadow Warriors', 'Thunder Strike', 'Viper Squad', 'Ghost Legion',
    'Apex Predators', 'Iron Wolves', 'Storm Chasers', 'Silent Assassins', 'Dragon Force',
    'Elite Guards', 'Night Hawks', 'Rogue Titans', 'Cyber Ninjas', 'Fatal Five',
    'Blaze Runners', 'Dark Knights', 'Wild Beasts', 'Royal Flush', 'Alpha Squad',
    'Savage Kings', 'Terror Squad', 'Victory Legion', 'Unstoppable', 'Infinity Warriors',
    'Domination', 'Revenge Gaming', 'Legacy Esports', 'Dynasty Pro', 'Empire Strike'
];

const teamTags = [
    'PHX', 'SDW', 'THN', 'VPR', 'GST',
    'APX', 'IRW', 'STM', 'SLA', 'DRG',
    'ELT', 'NHK', 'RGT', 'CBN', 'FTL',
    'BLZ', 'DKN', 'WLD', 'RYL', 'ALP',
    'SVG', 'TRR', 'VCT', 'UNS', 'INF',
    'DOM', 'RVG', 'LGC', 'DYN', 'EMP'
];

// For Player model inGameRole
const playerRoles = ['Assaulter', 'IGL', 'Support', 'Fragger', 'Sniper'];

// For Registration model roster.role
const rosterRoles = ['IGL', 'Fragger', 'Support', 'Sniper', 'Substitute'];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

async function main() {
    try {
        console.log('🚀 Starting script to add 30 teams to tournament...\n');

        console.log('📡 Connecting to database...');
        await connectDB();
        console.log('✓ Connected to database\n');

        console.log('🔍 Checking tournament...');
        const tournament = await Tournament.findById(TOURNAMENT_ID);
        if (!tournament) {
            throw new Error(`❌ Tournament with ID ${TOURNAMENT_ID} not found`);
        }
        if (!tournament.phases || tournament.phases.length === 0) {
            throw new Error('❌ Tournament has no phases');
        }

        console.log(`✓ Found tournament: ${tournament.tournamentName}`);
        console.log(`✓ First phase: ${tournament.phases[0].name || 'Phase 1'}\n`);

        // 1. Create 120 sample players (30 teams × 4 players)
        console.log('👥 Creating 120 players...');
        const hashedPassword = await bcrypt.hash('player123', 10);
        const players = [];

        for (let i = 1; i <= 120; i++) {
            const firstName = getRandomElement(firstNames);
            const lastName = getRandomElement(lastNames);
            const timestamp = Date.now();
            const username = `${firstName.toLowerCase()}${timestamp}${i}`;
            const inGameName = `${firstName.slice(0, 3).toUpperCase()}${i}`;

            const player = new Player({
                username,
                inGameName,
                realName: `${firstName} ${lastName}`,
                email: `${username}@example.com`,
                password: hashedPassword,
                isEmailVerified: true,
                verified: true,
                country: 'India',
                primaryGame: 'BGMI',
                inGameRole: getRandomElements(playerRoles, Math.floor(Math.random() * 2) + 1),
                teamStatus: 'in a team',
                profileVisibility: 'public',
                bio: `Competitive BGMI player from India`,
                availability: getRandomElement(['weekends only', 'evenings', 'flexible', 'full time']),
                aegisRating: Math.floor(Math.random() * 1500) + 500,
            });
            players.push(player);
        }

        const insertedPlayers = await Player.insertMany(players);
        console.log(`✓ Created ${insertedPlayers.length} players\n`);

        // 2. Create 30 teams (4 players each)
        console.log('🏆 Creating 30 teams...');
        const teams = [];

        for (let i = 0; i < 30; i++) {
            const teamPlayers = insertedPlayers.slice(i * 4, (i + 1) * 4);

            if (teamPlayers.length < 4) {
                console.warn(`⚠️  Warning: Team ${i + 1} only has ${teamPlayers.length} players`);
            }

            const teamName = teamNames[i];
            const teamTag = teamTags[i];
            const teamId = await Team.generateTeamId();

            const team = new Team({
                teamId,
                teamName,
                teamTag,
                logo: 'https://placehold.co/200x200/1a1a1a/ffffff?text=' + teamTag,
                country: 'India',
                players: teamPlayers.map(p => p._id),
                captain: teamPlayers[0]._id,
                primaryGame: 'BGMI',
                region: 'India',
                bio: `${teamName} - Competitive BGMI team from India`,
                establishedDate: new Date(),
                profileVisibility: 'public',
                status: 'active',
                aegisRating: Math.floor(Math.random() * 1500) + 800,
                statistics: {
                    tournamentsPlayed: Math.floor(Math.random() * 10),
                    matchesPlayed: Math.floor(Math.random() * 50),
                    totalKills: Math.floor(Math.random() * 500),
                    chickenDinners: Math.floor(Math.random() * 10),
                    averagePlacement: Math.floor(Math.random() * 10) + 1,
                    winRate: Math.floor(Math.random() * 40),
                },
            });

            teams.push(team);

            // Update players with team reference
            for (const player of teamPlayers) {
                player.team = team._id;
            }
        }

        const insertedTeams = await Team.insertMany(teams);
        console.log(`✓ Created ${insertedTeams.length} teams`);

        // Update players with team references
        await Promise.all(insertedPlayers.map(p => p.save()));
        console.log(`✓ Updated player.team references\n`);

        // 3. Create Registration documents for all teams
        console.log('📝 Registering teams in tournament...');
        const registrations = [];
        const firstPhaseName = tournament.phases[0].name || 'Phase 1';

        for (const team of insertedTeams) {
            const registration = new Registration({
                tournament: TOURNAMENT_ID,
                team: team._id,
                status: 'approved',
                qualifiedThrough: 'open_registration',
                currentStage: firstPhaseName,
                phase: firstPhaseName,
                group: '', // Can be assigned later
                registeredAt: new Date(),
                approvedAt: new Date(),
                roster: team.players.map((playerId, idx) => ({
                    player: playerId,
                    role: rosterRoles[idx] || 'Fragger',
                    inGameName: insertedPlayers.find(p => p._id.equals(playerId))?.inGameName || `Player${idx + 1}`,
                })),
                totalTournamentPoints: 0,
                totalTournamentKills: 0,
                totalChickenDinners: 0,
                matchesPlayed: 0,
            });
            registrations.push(registration);
        }

        const insertedRegistrations = await Registration.insertMany(registrations);
        console.log(`✓ Created ${insertedRegistrations.length} registration documents\n`);

        // 4. Add teams to the first phase
        console.log('📊 Adding teams to first phase...');
        const firstPhase = tournament.phases[0];

        // Add teams to phase
        if (!firstPhase.teams) {
            firstPhase.teams = [];
        }
        firstPhase.teams.push(...insertedTeams.map(t => t._id));

        // Update tournament counts
        tournament.participatingTeamsCount = (tournament.participatingTeamsCount || 0) + 30;
        if (tournament.slots) {
            tournament.slots.registered = (tournament.slots.registered || 0) + 30;
        }

        await tournament.save();
        console.log(`✓ Added ${insertedTeams.length} teams to ${firstPhaseName}\n`);

        // Summary
        console.log('✨ Summary:');
        console.log(`   - Players created: ${insertedPlayers.length}`);
        console.log(`   - Teams created: ${insertedTeams.length}`);
        console.log(`   - Registrations created: ${insertedRegistrations.length}`);
        console.log(`   - Teams in first phase: ${firstPhase.teams.length}`);
        console.log(`   - Tournament total teams: ${tournament.participatingTeamsCount}\n`);

        await mongoose.disconnect();
        console.log('✅ Script completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
