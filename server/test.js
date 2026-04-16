import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI is required to run test.js');
}

mongoose.connect(mongoUri).then(async () => {
  const team = await mongoose.connection.db.collection('teams').findOne({ _id: new mongoose.Types.ObjectId('699b4b11d859d3a229ee3d19') });
  console.log('STATISTICS:', JSON.stringify(team.statistics, null, 2));
  console.log('tournamentsWon (if any):', team.tournamentsWon || (team.statistics && team.statistics.tournamentsWon));
  mongoose.disconnect();
}).catch(e => console.error(e));
