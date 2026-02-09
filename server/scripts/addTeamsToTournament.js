import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';
import bcrypt from 'bcrypt';

const TOURNAMENT_ID = '698a259f51b4bdea2a57ac11';

// Sample Indian names
const firstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advait', 'Dhruv', 'Kabir', 'Shivansh', 'Ritvik', 'Ansh',
    'Reyansh', 'Daksh', 'Kiaan', 'Yash', 'Aarush', 'Rudra', 'Ved', 'Veer', 'Aayansh', 'Raghav'
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
    'Savage Kings', 'Terror Squad', 'Victory Legion', 'Unstoppable', 'Infinity',
    'Domination', 'Revenge', 'Legacy', 'Dynasty', 'Empire', 'Uprising'
];

const inGameRoles = ['Fragger', 'Support', 'IGL', 'Assaulter', 'Sniper'];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function main() {
    try {
        console.log('Connecting to database...');
        await connectDB();

        console.log('Checking tournament...');
        const tournament = await Tournament.findById(TOURNAMENT_ID);
        if (!tournament) {
            throw new Error(`Tournament with ID ${TOURNAMENT_ID} not found`);
        }
        if (!tournament.phases || tournament.phases.length === 0) {
            throw new Error('Tournament has no phases');
        }

        console.log(`Found tournament: ${tournament.tournamentName}`);
        console.log(`First phase: ${tournament.phases[0].name || 'Phase 1'}`);

        // 1. Create 124 sample players
        console.log('\nCreating 124 players...');
        const hashedPassword = await bcrypt.hash('player123', 10);
        const players = [];

        for (let i = 1; i <= 124; i++) {
            const firstName = getRandomElement(firstNames);
            const lastName = getRandomElement(lastNames);
            const username = `${firstName.toLowerCase()}${i}`;
            const inGameName = `${firstName.slice(0, 3).toUpperCase()}${i}`;

            const player = new Player({
                username,
                inGameName,
                realName: `${firstName} ${lastName}`,
                email: `${username}@example.com`,
                password: hashedPassword,
                isEmailVerified: true,
                country: 'India',
                primaryGame: 'BGMI',
                inGameRole: [getRandomElement(['Assaulter', 'IGL', 'Support', 'Sniper', 'Fragger'])],
                teamStatus: 'in a team',
                profileVisibility: 'public',
                bio: `Competitive BGMI player`,
                experienceLevel: getRandomElement(['beginner', 'intermediate', 'advanced', 'professional']),
            });
            players.push(player);
        }

        await Player.insertMany(players);
        console.log(`✓ Created ${players.length} players`);

        // 2. Create 31 teams (4 players each)
        console.log('\nCreating 31 teams...');
        const teams = [];

        for (let i = 0; i < 31; i++) {
            const teamPlayers = players.slice(i * 4, (i + 1) * 4);
            if (teamPlayers.length < 4) {
                console.warn(`Warning: Team ${i + 1} only has ${teamPlayers.length} players`);
            }

            const teamName = teamNames[i];
            // Generate teamTag: acronym for multi-word, first 3-5 chars for single word
            let teamTag;
            const words = teamName.split(' ');
            if (words.length > 1) {
                // Multi-word: use first letters (e.g., "Phoenix Riders" -> "PR")
                teamTag = words.map(w => w[0]).join('').toUpperCase().slice(0, 5);
            } else {
                // Single word: use first 3-5 chars (e.g., "Uprising" -> "UPR")
                teamTag = teamName.slice(0, 5).toUpperCase();
            }
            const teamId = await Team.generateTeamId();

            const team = new Team({
                teamId,
                teamName: `${teamName}`,
                teamTag,
                logo: `https://placehold.co/200x200/1a1a1a/ffffff?text=${teamTag}`,
                country: 'India',
                players: teamPlayers.map(p => p._id),
                captain: teamPlayers[0]?._id,
                primaryGame: 'BGMI',
                region: 'India',
                bio: `Professional BGMI team competing in ${tournament.tournamentName}`,
            });

            teams.push(team);

            // Update each player's team field
            for (const player of teamPlayers) {
                player.team = team._id;
            }
        }

        await Team.insertMany(teams);
        await Promise.all(players.map(p => p.save()));
        console.log(`✓ Created ${teams.length} teams`);

        // 3. Register all teams in the tournament
        console.log('\nRegistering teams in tournament...');
        const registrations = [];
        const firstPhaseName = tournament.phases[0].name || 'Phase 1';

        for (const team of teams) {
            const roster = team.players.map((pid, idx) => ({
                player: pid,
                role: inGameRoles[idx % inGameRoles.length]
            }));

            registrations.push({
                tournament: TOURNAMENT_ID,
                team: team._id,
                status: 'approved',
                phase: firstPhaseName,
                group: '', // Will be assigned later
                qualifiedThrough: 'open_registration',
                roster: roster,
                registeredAt: new Date(),
            });
        }

        await Registration.insertMany(registrations);
        console.log(`✓ Created ${registrations.length} registrations`);

        // 4. Add all teams to the first phase of the tournament
        console.log('\nAdding teams to first phase...');
        const firstPhase = tournament.phases[0];
        firstPhase.teams = teams.map(t => t._id);
        firstPhase.status = 'upcoming';

        // Update participating teams count
        tournament.participatingTeamsCount = teams.length;
        tournament.slots.registered = teams.length;

        await tournament.save();
        console.log(`✓ Added ${teams.length} teams to phase: ${firstPhaseName}`);

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('SUMMARY');
        console.log('='.repeat(50));
        console.log(`Tournament: ${tournament.tournamentName}`);
        console.log(`Tournament ID: ${TOURNAMENT_ID}`);
        console.log(`Phase: ${firstPhaseName}`);
        console.log(`Players Created: ${players.length}`);
        console.log(`Teams Created: ${teams.length}`);
        console.log(`Registrations: ${registrations.length}`);
        console.log('='.repeat(50));

        await mongoose.disconnect();
        console.log('\n✓ Done! Database disconnected.');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
