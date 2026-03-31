import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from './models/team.model.js';
import Player from './models/player.model.js';
import Registration from './models/registration.model.js';
import Match from './models/match.model.js';
import { recalculateStatsForTeams } from './routes/match.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const teams = await Team.find({}).select('_id').lean();
  const teamIds = teams.map(t => t._id);
  
  console.log(`Recalculating stats for ${teamIds.length} teams...`);
  
  // Re-run the logic we just updated
  await recalculateStatsForTeams(teamIds);
  
  console.log('Recalculation complete.');

  // Check a specific player
  const p = await Player.findOne({ username: 'player1ign' }).lean();
  console.log('Verification for player1ign:');
  console.log('Matches Played:', p.matchesPlayed);
  console.log('Tournaments Played:', p.tournamentsPlayed);
  console.log('Statistics:', JSON.stringify(p.statistics, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
