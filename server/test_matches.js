import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI is required to run test_matches.js');
}

mongoose.connect(mongoUri).then(async () => {
  const matches = await mongoose.connection.db.collection('matches').find({ 'results.team': new mongoose.Types.ObjectId('699b4b11d859d3a229ee3d19') }).toArray();
  const summary = matches.map(m => {
    const teamRes = m.results.find(r => r.team.toString() === '699b4b11d859d3a229ee3d19');
    return {
      matchId: m._id,
      finalPosition: teamRes ? teamRes.finalPosition : null,
      chickenDinner: teamRes ? teamRes.chickenDinner : null
    }
  });
  console.log('Match Results:', JSON.stringify(summary, null, 2));
  mongoose.disconnect();
}).catch(e => console.error(e));
