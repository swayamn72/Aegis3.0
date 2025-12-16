import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';

const TOURNAMENT_ID = '693fb61d10212b233854ce4d';

async function main() {
    await connectDB();

    // 1. Create 124 sample players
    const players = [];
    for (let i = 1; i <= 124; i++) {
        const player = new Player({
            username: `player${i}`,
            inGameName: `IGN${i}`,
            realName: `Player ${i}`,
            email: `player${i}@example.com`,
            password: 'hashedpassword', // Use a real hash in production
            verified: true,
            country: 'India',
            primaryGame: 'BGMI',
            inGameRole: ['assaulter'],
            teamStatus: 'in a team',
            profileVisibility: 'public',
        });
        players.push(player);
    }
    await Player.insertMany(players);
    console.log('Created 124 players');

    // 2. Create 31 teams (4 players each, last team has 0-3 extra)
    const teams = [];
    for (let i = 0; i < 31; i++) {
        const teamPlayers = players.slice(i * 4, (i + 1) * 4);
        // teamTag: T01, T02, ..., T31 (always 3 chars, fits maxlength: 6)
        const teamTag = `T${String(i + 1).padStart(2, '0')}`;
        const team = new Team({
            teamName: `Team${i + 1}`,
            teamTag,
            logo: '',
            country: 'India',
            players: teamPlayers.map(p => p._id),
            captain: teamPlayers[0]?._id,
            primaryGame: 'BGMI',
            region: 'India',
        });
        teams.push(team);
    }
    await Team.insertMany(teams);
    console.log('Created 31 teams');

    // 3. Register all teams in the tournament
    const registrations = [];
    for (const team of teams) {
        registrations.push({
            tournament: TOURNAMENT_ID,
            team: team._id,
            status: 'approved',
            phase: '', // Will set for first phase below
            group: '',
            qualifiedThrough: 'open_registration',
            roster: team.players.map(pid => ({ player: pid, role: 'Fragger' })),
        });
    }
    await Registration.insertMany(registrations);
    console.log('Registered all teams in tournament');

    // 4. Add all teams to the first phase of the tournament
    const tournament = await Tournament.findById(TOURNAMENT_ID);
    if (!tournament) throw new Error('Tournament not found');
    if (!tournament.phases || tournament.phases.length === 0) throw new Error('No phases in tournament');
    const firstPhase = tournament.phases[0];
    firstPhase.teams = teams.map(t => t._id);
    await tournament.save();
    console.log('Added all teams to first phase');

    await mongoose.disconnect();
    console.log('Done!');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
