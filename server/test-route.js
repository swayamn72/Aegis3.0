import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import Tournament from './models/tournament.model.js';
import Registration from './models/registration.model.js';

async function testQuery() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');
  
  const tournamentId = '69a6fce25061f0d80c2ab07f';
  const phase = 'Round 2';
  
  const query = Registration.find({
      tournament: tournamentId,
      phase,
      status: { $nin: ['rejected', 'withdrawn'] }
  })
  .populate('team', 'teamName teamTag logo')
  .select('team group status registeredAt');
  
  const registrations = await query.lean();
  console.log(`Found ${registrations.length} registrations for phase ${phase}`);
  
  let crashCount = 0;
  for (const r of registrations) {
      if (!r.team) {
          console.log(`Registration ${r._id} has null r.team after population! raw team field:`, await Registration.findById(r._id).select('team').lean());
          crashCount++;
      } else {
        try {
            const temp = r.team._id;
        } catch(e) {
            console.log(`Registration ${r._id} crashed on r.team._id`, e);
            crashCount++;
        }
      }
  }
  
  console.log(`Total that would crash: ${crashCount}`);
  process.exit(0);
}

testQuery().catch(console.error);
