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
    name: 'Lastade Esports',
    players: ['SHADOW', 'EVIL', 'KAALAN', 'SPY', 'AFU'],
    coach: null
  },
  {
    name: '4TR Official',
    players: ['ANONYMOUS', 'ARTHER', 'RAPIDO', 'FLEXJOD', 'VIPER_4TR'], // avoid collision if VIPER exists
    coach: null
  },
  {
    name: '7Gods Esports',
    players: ['MOKSH', 'REXBOY', 'NINJAA', 'NINNJUU', 'NOIR'],
    coach: null
  },
  {
    name: 'K9 Esports',
    players: ['SAUMRAJ', 'SMOKER', 'STRANGER', 'SNOWJOD', 'TAURUS'],
    coach: 'XYPEX'
  },
  {
    name: 'Troy Tamilan Esports',
    players: ['AYDEN', 'HESPEROS', 'LENS', 'MAXIOSO', 'JAZZY'],
    coach: 'VPIX'
  },
  {
    name: 'Jaguar Esports',
    players: ['BHAALU', 'AVNISH', 'PIXIE', 'SHOGUN', 'AVANZA'],
    coach: null
  },
  {
    name: 'MadKings',
    players: ['SHADOWOG', 'CLUTCHGOD', 'SIMP', 'TROYE', 'NOBII'],
    coach: null
  },
  {
    name: 'White Walkers',
    players: ['DREAMS', 'ANUJTOOOP', 'BEAST04', 'VEYRON', 'ARYZEN'],
    coach: null
  },
  {
    name: 'Team Apex Gaming',
    players: ['JELLY', 'HYDRO', 'HARSH', 'KIOLMAO', 'JONATHAN'],
    coach: 'SATYAM'
  },
  {
    name: 'iQOO 8Bit',
    players: ['JUICY', 'SARANG', 'SKIPZ', 'SHUBH', 'SHORTY'],
    coach: null
  },
  {
    name: 'RiotNationZ',
    players: ['AADI', 'EEZY', 'SUNOJ', 'PUNK', 'DOLLAR'],
    coach: null
  },
  {
    name: 'Naqsh Esports',
    players: ['PMWIIGL', 'OWENOG', 'INFGOD', 'SKILLFULL', 'EXECUTOR'],
    coach: null
  },
  {
    name: 'H4K Esports',
    players: ['SUJAL', 'RAGEGOD', 'WIZARD', 'MAC', 'NODII'],
    coach: null
  },
  {
    name: 'Higg Boson Esports',
    players: ['BUNNY', 'HEROO', 'GODX', 'RUSHBOY', 'WHITETIGER'],
    coach: null
  },
  {
    name: 'HadX Esports',
    players: ['CYPHER', 'CEAZAR', 'RISHI', 'JAXX', 'HOPE'],
    coach: 'GURASEEM'
  },
  {
    name: 'Windgod Esports',
    players: ['RYZEN', 'INFINITY', 'KYZER', 'RIOO', 'PROBOT'],
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

async function seedBMPSGroupB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findOne({ slug: 'battlegrounds-mobile-pro-series-2026' });
    if (!tournament) {
      throw new Error('BMPS 2026 not found');
    }

    const phase = tournament.phases[0]; // Qualifiers Round 1
    const groupB = phase.groups.find(g => g.name === 'Group B');

    if (!groupB) {
      throw new Error('Group B not found in Qualifiers Round 1');
    }

    // Initialize arrays if missing
    if (!phase.teams) phase.teams = [];
    if (!groupB.teams) groupB.teams = [];

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
          group: 'Group B'
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
      if (!groupB.teams.includes(team._id)) {
        groupB.teams.push(team._id);
      }

      console.log(`Successfully added team: ${team.teamName}`);
    }

    await tournament.save();
    console.log('Finished seeding Group B for BMPS 2026!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Group B:', error);
    process.exit(1);
  }
}

seedBMPSGroupB();
