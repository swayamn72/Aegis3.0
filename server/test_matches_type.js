import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI is required to run test_matches_type.js');
}

mongoose.connect(mongoUri).then(async () => {
  const matches = await mongoose.connection.db.collection('matches')
    .find({ 'results.team': new mongoose.Types.ObjectId('699b4b11d859d3a229ee3d19') })
    .toArray();

  const summary = matches.map(m => {
    return {
      matchId: m._id,
      map: m.map,
      matchType: m.matchType,
      status: m.status
    }
  });

  console.log('Match DB Records:', JSON.stringify(summary, null, 2));
  mongoose.disconnect();
}).catch(e => console.error(e));
