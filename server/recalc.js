import mongoose from 'mongoose';
import { recalculateStatsForTeams } from './routes/match.routes.js';
mongoose.connect('mongodb+srv://aegis-admin-1:swayamn75@cluster0.mxdgc7b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(async () => {
  await recalculateStatsForTeams(['699b4b11d859d3a229ee3d19']);
  console.log('Recalculated stats for Team storms');
  mongoose.disconnect();
}).catch(e => console.error(e));
