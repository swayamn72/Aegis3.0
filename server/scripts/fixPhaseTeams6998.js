/**
 * fixPhaseTeams6998.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time fix: syncs tournament.phases[0].teams with all approved/pending
 * Registration documents for tournament 6998a44234a999a394ffb582.
 *
 * The Groups tab reads tournament.phases[x].teams, while the Teams tab reads
 * the Registration collection. Any team registered via the route (not the seed
 * script) was only added to Registration — not to phases[0].teams.
 *
 * Run once:
 *   node scripts/fixPhaseTeams6998.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';

const TOURNAMENT_ID = '6998a44234a999a394ffb582';

async function main() {
    try {
        console.log('\n🔧  fixPhaseTeams6998 — syncing phases[0].teams with Registration docs\n');

        await connectDB();
        console.log('✓   Connected to DB\n');

        // 1. Load tournament
        const tournament = await Tournament.findById(TOURNAMENT_ID);
        if (!tournament) throw new Error(`Tournament ${TOURNAMENT_ID} not found`);
        if (!tournament.phases?.length) throw new Error('Tournament has no phases');

        const firstPhase = tournament.phases[0];
        console.log(`✓   Tournament : "${tournament.tournamentName}"`);
        console.log(`✓   Phase      : "${firstPhase.name}"`);
        console.log(`    Currently in phases[0].teams: ${firstPhase.teams?.length || 0} teams\n`);

        // 2. Get all registered team IDs (any non-rejected/non-withdrawn status)
        const registrations = await Registration.find({
            tournament: TOURNAMENT_ID,
            status: { $nin: ['rejected', 'withdrawn'] }
        }).select('team').lean();

        const registeredTeamIds = registrations.map(r => r.team.toString());
        console.log(`✓   Registrations found: ${registeredTeamIds.length}`);

        // 3. Find which ones are missing from phases[0].teams
        const alreadyInPhase = new Set(
            (firstPhase.teams || []).map(t => t.toString())
        );

        const missingTeamIds = registeredTeamIds.filter(id => !alreadyInPhase.has(id));
        console.log(`✓   Teams already in phase: ${alreadyInPhase.size}`);
        console.log(`⚠️   Teams MISSING from phase: ${missingTeamIds.length}\n`);

        if (missingTeamIds.length === 0) {
            console.log('✅  Nothing to fix — phases[0].teams is already in sync!');
            await mongoose.disconnect();
            return;
        }

        // 4. Push missing team IDs into phases[0].teams
        await Tournament.updateOne(
            { _id: TOURNAMENT_ID, 'phases._id': firstPhase._id },
            { $push: { 'phases.$.teams': { $each: missingTeamIds.map(id => new mongoose.Types.ObjectId(id)) } } }
        );

        // 5. Verify
        const updated = await Tournament.findById(TOURNAMENT_ID).select('phases').lean();
        const updatedPhaseTeams = updated.phases[0]?.teams?.length || 0;

        console.log(`✅  Fixed! phases[0].teams now has: ${updatedPhaseTeams} teams`);
        console.log(`    (Added ${missingTeamIds.length} missing team(s))\n`);

        await mongoose.disconnect();
        console.log('✓   DB disconnected. Done!\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌  Error:', err.message);
        console.error(err);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    }
}

main();
