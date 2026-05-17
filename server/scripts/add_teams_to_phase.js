import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';

const TOURNAMENT_ID = '6a0827e7f853d1c1eee4e618';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const tournament = await Tournament.findById(TOURNAMENT_ID);
        if (!tournament || !tournament.phases || tournament.phases.length === 0) {
            console.error('Tournament not found or has no phases');
            process.exit(1);
        }

        const phase = tournament.phases[0]; // the only phase
        const phaseName = phase.name;

        // Get all approved registrations for this tournament
        const registrations = await Registration.find({
            tournament: TOURNAMENT_ID,
            status: 'approved'
        });

        const teamIds = registrations.map(r => r.team);

        // Update the phase teams in tournament
        // Avoid duplicates if script is run multiple times
        const existingTeamsStr = new Set(phase.teams.map(t => t.toString()));
        const newTeamIds = teamIds.filter(id => !existingTeamsStr.has(id.toString()));
        
        phase.teams.push(...newTeamIds);
        await tournament.save();

        // Update phase name in registrations
        await Registration.updateMany(
            { _id: { $in: registrations.map(r => r._id) } },
            { $set: { phase: phaseName } }
        );

        console.log(`✅ Added ${teamIds.length} teams to phase "${phaseName}"`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
