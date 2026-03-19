import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

// Load models dynamically to ensure they register
import './models/tournament.model.js';
import './models/team.model.js';
import Registration from './models/registration.model.js';

async function testPopulate() {
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
  
  let nullCount = 0;
  for (const r of registrations) {
      if (!r.team) {
          nullCount++;
      }
  }
  
  console.log(`Null r.team count: ${nullCount}`);
  process.exit(0);
}

testPopulate().catch(console.error);
