import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Emulate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

import Tournament from './models/tournament.model.js';
import Player from './models/player.model.js';
import Team from './models/team.model.js';
import Registration from './models/registration.model.js';

const teamsData = [
  {
    name: 'T7 x Orion Esports',
    players: ['CABEZAIGL', 'MUDIT', 'FANTOM', 'FIROO', 'REVERSE'],
    coach: null
  },
  {
    name: 'NonX Esports',
    players: ['AMAN', 'SYRUS', 'STUNNER', 'HEXY', 'DGBOT'],
    coach: null
  },
  {
    name: 'Blink Esports',
    players: ['MAYANK', 'PROFESIR', 'JAYESH', 'HARDIKUG', 'NEXXUS'],
    coach: null
  },
  {
    name: '7Aces x TRB Esports',
    players: ['CODER', 'KRAXX', 'ROLEX', 'AMMYJOD', 'GONU'],
    coach: null
  },
  {
    name: 'GENxFM Esports',
    players: ['DIPOP', 'DAMUU', 'GHOST', 'BUNNY_GEN', 'MOGLIOP'],
    coach: null
  },
  {
    name: 'Team Flying Esports',
    players: ['WHYBRO', 'JATT', 'KNOWME_FLY', 'HUNTER', 'COBRA'],
    coach: null
  },
  {
    name: 'Mysterious4 Esports',
    players: ['GOKU', 'NAMAN', 'NOOB', 'KRSNAJOD', 'HENRY'],
    coach: null
  },
  {
    name: 'ThunderGods x Tortuga Gaming',
    players: ['ABHI', 'FRAGGER_TG', 'CLOZY', 'ICY', 'RAMBO'],
    coach: null
  },
  {
    name: 'Ares Esport',
    players: ['ERROROG', 'BIJOY', 'KNUCKLE', 'BAITER', 'CLUTCHBOI'],
    coach: null
  },
  {
    name: 'Likitha Esports',
    players: ['DANIAL', 'ZEMO', 'FUSIONX', 'STARBOY', 'INFERNO'],
    coach: null
  },
  {
    name: 'Santa Esp',
    players: ['ALPHA', 'ADONIS', 'BANDIT', 'COFFIN', 'PUNISHER'],
    coach: null
  },
  {
    name: 'Rising Esports',
    players: ['BEARDBABA', 'YUVA', 'EZOL', 'FOXOP', 'FOUL'],
    coach: null
  },
  {
    name: 'Godsent Legions',
    players: ['HARSHOG', 'MASTER', 'TOXICOP', 'EMPEROR', 'SKEPP'],
    coach: null
  },
  {
    name: 'Rapid Chaos Esports',
    players: ['FLASH', 'DHRUVOG', 'PSYCHO', 'TOXIC', 'FRAGGER_RC'],
    coach: null
  },
  {
    name: 'Zero Ark Official',
    players: ['MORTY', 'PAINISLIVE', 'JATINOG', 'CHANDANOP', 'SARWAROG'],
    coach: null
  },
  {
    name: 'Aura X Esports',
    players: ['WANTED', 'FRAGGER_AX', 'KALYUG', 'KRISOP', 'DOPE'],
    coach: null
  }
];

async function createShadowPlayer(username, isCoach) {
  let player = await Player.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  if (!player) {
    player = new Player({
      username,
      email: `${username.toLowerCase()}@shadow.aegis`,
      realName: username,
      inGameRole: isCoach ? 'Coach' : 'Assaulter',
      gameIds: [
        {
          game: 'BGMI',
          inGameName: username,
          isPrimary: true
        }
      ],
      verified: false
    });
    await player.save();
  }
  return player;
}

async function seedBMPSGroupC() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findOne({ slug: 'battlegrounds-mobile-pro-series-2026' });
    if (!tournament) {
      throw new Error('BMPS 2026 not found');
    }

    const phase = tournament.phases[0]; // Qualifiers Round 1
    const groupC = phase.groups.find(g => g.name === 'Group C');

    if (!groupC) {
      throw new Error('Group C not found in Qualifiers Round 1');
    }

    // Initialize arrays if missing
    if (!phase.teams) phase.teams = [];
    if (!groupC.teams) groupC.teams = [];

    for (const teamData of teamsData) {
      // 1. Create players
      const playerIds = [];
      let captainId = null;
      for (const pName of teamData.players) {
        const p = await createShadowPlayer(pName, false);
        playerIds.push(p._id);
        if (!captainId) captainId = p._id; // First player is captain
      }

      // 2. Create coach
      let coachId = null;
      if (teamData.coach) {
        const c = await createShadowPlayer(teamData.coach, true);
        coachId = c._id;
      }

      // 3. Create or find team
      let team = await Team.findOne({ teamName: teamData.name });
      if (!team) {
        const teamId = Math.random().toString(36).substring(2, 8).toUpperCase();
        team = new Team({
          teamId,
          teamName: teamData.name,
          captain: captainId,
          coach: coachId,
          players: playerIds,
          primaryGame: 'BGMI',
          region: 'India'
        });
        await team.save();

        // Update player's teams map
        for (const pid of [...playerIds, coachId].filter(Boolean)) {
          const p = await Player.findById(pid);
          if (p) {
            if (!p.teams) p.teams = {};
            p.teams.set('BGMI', team._id);
            await p.save();
          }
        }
      }

      // 4. Create Registration
      let registration = await Registration.findOne({ tournament: tournament._id, team: team._id });
      if (!registration) {
        registration = new Registration({
          tournament: tournament._id,
          team: team._id,
          gameTitle: 'BGMI',
          status: 'approved',
          qualifiedThrough: 'invite',
          isDirectInvite: true,
          phase: phase.name,
          group: 'Group C'
        });
        await registration.save();
        
        // Update tournament counts
        tournament.slots.registered += 1;
        tournament.participatingTeamsCount += 1;
      }

      // 5. Add to Phase and Group
      if (!phase.teams.includes(team._id)) {
        phase.teams.push(team._id);
      }
      if (!groupC.teams.includes(team._id)) {
        groupC.teams.push(team._id);
      }

      console.log(`Successfully added team: ${team.teamName}`);
    }

    await tournament.save();
    console.log('Finished seeding Group C for BMPS 2026!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Group C:', error);
    process.exit(1);
  }
}

seedBMPSGroupC();
