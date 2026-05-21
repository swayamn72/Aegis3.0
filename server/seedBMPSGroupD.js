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
    name: 'Esport Social',
    players: ['BADOP', 'GYROGOD', 'JOYESH', 'MANNYJOD', 'SUPERMAN'],
    coach: null
  },
  {
    name: 'Team AX',
    players: ['ARYAN', 'DEVOTEEE', 'SYRAX', 'PRO_AX', 'RAIDEN'],
    coach: null
  },
  {
    name: 'Someones Dream',
    players: ['DIZZY', 'GHOSTFXCE', 'ISCREAM', 'KARANNOTOP', 'GOTEN_SD'],
    coach: null
  },
  {
    name: 'Team Doxy',
    players: ['DOXY', 'BEASTBOY', 'DEATHGOD', 'YEPEZZZ', 'UNQ'],
    coach: null
  },
  {
    name: 'Jaapi Esports',
    players: ['DREAMS_JE', 'GHOSTOG', 'EXPLOSER', 'SKOP', 'CATALYST'],
    coach: null
  },
  {
    name: 'Oops Official',
    players: ['RAIX', 'AFFUOP', 'ZENTRIX', 'ELEMENT', 'REAPER_OO'],
    coach: null
  },
  {
    name: 'Versatile Esports',
    players: ['REXX', 'SPARTAN', 'SMOKER_VE', 'KESHU', 'CLIX'],
    coach: null
  },
  {
    name: 'Autobotz Esports',
    players: ['AREEB', 'RALPHIE', 'LOBSTER', 'FANOP', 'EGGY'],
    coach: null
  },
  {
    name: 'Phoenix Esports',
    players: ['ECLIPSEOP', 'VENGEANCE', 'FAITH', 'FRENZYOK', 'ARNAV'],
    coach: null
  },
  {
    name: 'Futurise Esports Empire Originals',
    players: ['NORM4NJR', 'COMMANDO', 'WARBOYPLAYZ', 'TONY', 'SHOOTER'],
    coach: null
  },
  {
    name: 'Gods Reign',
    players: ['NEYO', 'DELTAPG', 'JUSTIN', 'AQUANOX', 'DESTRO'],
    coach: 'Robin'
  },
  {
    name: 'Quantum Sparks',
    players: ['SCOUTOP', 'YASHU', 'MASTER_QS', 'DAKSH', 'ARCHIT'],
    coach: null
  },
  {
    name: 'True Rippers',
    players: ['PUNK_TR', 'OMEGAA', 'SHAYAAN', 'TERMI', 'ACHUKK'],
    coach: null
  },
  {
    name: 'Team RedXross',
    players: ['LUCIFER_RX', 'ZEREFF', 'ARMXN', 'SUPERB', 'AMAAN'],
    coach: null
  },
  {
    name: 'DC x SCR Esports',
    players: ['TAPGOD', 'ARTO', 'CHOKEBOY', 'YPRBOLTE', 'HARSHU'],
    coach: null
  },
  {
    name: 'Godsent Esports',
    players: ['FRAGGY', 'LEVII_GE', 'JUNAID', 'HUNTRO', 'REVENGE4U'],
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

async function seedBMPSGroupD() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findOne({ slug: 'battlegrounds-mobile-pro-series-2026' });
    if (!tournament) {
      throw new Error('BMPS 2026 not found');
    }

    const phase = tournament.phases[0]; // Qualifiers Round 1
    const groupD = phase.groups.find(g => g.name === 'Group D');

    if (!groupD) {
      throw new Error('Group D not found in Qualifiers Round 1');
    }

    // Initialize arrays if missing
    if (!phase.teams) phase.teams = [];
    if (!groupD.teams) groupD.teams = [];

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
          group: 'Group D'
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
      if (!groupD.teams.includes(team._id)) {
        groupD.teams.push(team._id);
      }

      console.log(`Successfully added team: ${team.teamName}`);
    }

    await tournament.save();
    console.log('Finished seeding Group D for BMPS 2026!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Group D:', error);
    process.exit(1);
  }
}

seedBMPSGroupD();
