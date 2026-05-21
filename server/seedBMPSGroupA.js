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
    name: 'iQOO SouL',
    players: ['NAKUL', 'GOBLIN', 'JOKER', 'LEGIT', 'THUNDER'],
    coach: 'AYOGI'
  },
  {
    name: 'Genesis Esports',
    players: ['GRAVITY', 'FURY', 'HUNTERZ', 'VIPER', 'ZAP'],
    coach: null
  },
  {
    name: 'iQOO Orangutan',
    players: ['AARU', 'AKOP', 'ATTANKI', 'WIZZGOD', 'PREM'],
    coach: null
  },
  {
    name: 'Victores Sumus',
    players: ['OWAIS', 'MAFIA', 'SCARRYJOD', 'VENOM', 'PARITOSH'],
    coach: null
  },
  {
    name: 'GodLike Esports',
    players: ['MANYA', 'ADMINO', 'SPOWER', 'GODZ', 'SAUMAY'],
    coach: null
  },
  {
    name: 'Divine Gaming',
    players: ['OMEGA', 'KNIGHT', 'NINJABOI', 'SLUG', 'AMIT_P'], // Avoid collision with AMIT coach
    coach: 'AMIT'
  },
  {
    name: 'iQOO Revenant XSpark',
    players: ['NINJAJOD', 'PAIN', 'TRACEGOD', 'PROTON', 'SUKUNA'],
    coach: 'EXPLICIT'
  },
  {
    name: 'Wyld Fangs',
    players: ['SENSEI', 'K4NHA', 'SPRAYGOD', 'GOTEN', 'SAM'],
    coach: null
  },
  {
    name: 'Vasista Esports',
    players: ['HECTOR', 'BEAST', 'RONY', 'AIMBOT', 'DIONYSUS'],
    coach: null
  },
  {
    name: 'Nebula Esports',
    players: ['AADIII', 'KNOWME', 'KRATOS', 'PHOENIX', 'ARJUN'],
    coach: null
  },
  {
    name: 'Learn from Past',
    players: ['HONEYY', 'MAXX', 'JD', 'Yash18', 'RYU'],
    coach: null
  },
  {
    name: 'Meta Ninza',
    players: ['SHADOW', 'FIERCE', 'APOLLOZ', 'JAVIN', 'AUXIN'],
    coach: 'OSMIUM'
  },
  {
    name: 'Myth Official',
    players: ['DETROX', 'ARYTON', 'DADDY', 'HARSHIL', 'LUCIFER'],
    coach: '24BABLU'
  },
  {
    name: 'iQOO Reckoning Esports',
    players: ['ROMAN', 'LEVII', 'SAHILOPAF', 'LOVISH', 'PROO'],
    coach: 'PROXY'
  },
  {
    name: 'iQOO Team Tamilas',
    players: ['MRIGL', 'AIMGOD', 'REAPER', 'MANTYOP', 'JUSTY'],
    coach: null
  },
  {
    name: 'Welt Esports',
    players: ['GOKUL', 'SHYAM', 'DRAGONOP', 'RICO', 'POKOWNL'],
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

async function seedBMPSGroupA() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findOne({ slug: 'battlegrounds-mobile-pro-series-2026' });
    if (!tournament) {
      throw new Error('BMPS 2026 not found');
    }

    const phase = tournament.phases[0]; // Qualifiers Round 1
    const groupA = phase.groups.find(g => g.name === 'Group A');

    if (!groupA) {
      throw new Error('Group A not found in Qualifiers Round 1');
    }

    // Initialize arrays if missing
    if (!phase.teams) phase.teams = [];
    if (!groupA.teams) groupA.teams = [];

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
          group: 'Group A'
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
      if (!groupA.teams.includes(team._id)) {
        groupA.teams.push(team._id);
      }

      console.log(`Successfully added team: ${team.teamName}`);
    }

    await tournament.save();
    console.log('Finished seeding Group A for BMPS 2026!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Group A:', error);
    process.exit(1);
  }
}

seedBMPSGroupA();
