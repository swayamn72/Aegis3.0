import 'dotenv/config';
import mongoose from 'mongoose';
import { recalculateStatsForTeams } from './routes/match.routes.js';

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI is required to run recalc.js');
}

mongoose.connect(mongoUri).then(async () => {
  await recalculateStatsForTeams(['699b4b11d859d3a229ee3d19']);
  console.log('Recalculated stats for Team storms');
  mongoose.disconnect();
}).catch(e => console.error(e));
