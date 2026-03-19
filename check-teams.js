const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const Tournament = require('./server/models/tournament.model');
const Registration = require('./server/models/registration.model');
const Team = require('./server/models/team.model');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');
  
  const tournamentId = '69a6fce25061f0d80c2ab07f';
  
  const regs = await Registration.find({ tournament: tournamentId }).lean();
  console.log(`Total registrations for tournament: ${regs.length}`);
  
  let nullTeamCount = 0;
  for (const reg of regs) {
    if (reg.team) {
      const team = await Team.findById(reg.team).lean();
      if (!team) {
        console.log(`Registration ${reg._id} points to missing team ${reg.team}`);
        nullTeamCount++;
      }
    } else {
        console.log(`Registration ${reg._id} has null team field`);
        nullTeamCount++;
    }
  }
  
  console.log(`Found ${nullTeamCount} registrations with missing teams`);
  process.exit(0);
}

check().catch(console.error);
