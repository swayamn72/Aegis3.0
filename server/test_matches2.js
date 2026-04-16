import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI is required to run test_matches2.js');
}

mongoose.connect(mongoUri).then(async () => {
  const matches = await mongoose.connection.db.collection('matches')
    .find({ 'results.team': new mongoose.Types.ObjectId('699b4b11d859d3a229ee3d19') })
    .toArray();

  console.log('Matches:', matches.map(m => ({
    map: m.map,
    actualEndTime: m.actualEndTime,
    tournamentPhase: m.tournamentPhase,
    status: m.status
  })));

  mongoose.disconnect();
}).catch(e => console.error(e));
