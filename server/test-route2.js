import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import './models/tournament.model.js';
import './models/team.model.js';
import Registration from './models/registration.model.js';

async function testRoute() {
  await mongoose.connect(process.env.MONGO_URI);
  const tournamentId = '69a6fce25061f0d80c2ab07f';
  const phase = 'Round 2';
  
  const query = Registration.find({
      tournament: tournamentId,
      phase,
      status: { $nin: ['rejected', 'withdrawn'] }
  })
  .populate('team', 'teamName teamTag logo')
  .select('team group status registeredAt')
  .skip((7 - 1) * 18).limit(18); // page 7
  
  const [registrations, total] = await Promise.all([
      query.lean(),
      Registration.countDocuments({
          tournament: tournamentId,
          phase,
          status: { $nin: ['rejected', 'withdrawn'] }
      })
  ]);
  
  try {
      const result = {
        phase,
        total,
        page: 7,
        limit: 18,
        teams: registrations
          .filter(r => r.team)
          .map(r => ({
            _id: r.team._id,
            teamName: r.team.teamName,
            teamTag: r.team.teamTag,
            logo: r.team.logo,
            group: r.group || null,
            status: r.status,
            registrationId: r._id
          }))
      };
      
      console.log('Result length:', result.teams.length);
  } catch(e) {
      console.error('Crash during mapping:', e);
  }
  process.exit(0);
}

testRoute();
