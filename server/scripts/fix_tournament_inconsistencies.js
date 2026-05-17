/**
 * fix_tournament_inconsistencies.js
 * 
 * Diagnoses and fixes database inconsistencies for tournament 6a0827e7f853d1c1eee4e618:
 * 1. Ensures all approved registrations have the correct phase name
 * 2. Ensures Tournament.phases[0].teams array is complete and deduplicated
 * 3. Syncs participatingTeamsCount with actual approved registrations
 * 4. Syncs slots.registered with total registration count
 * 5. Removes orphaned references to non-existent teams
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import Team from '../models/team.model.js';

const TOURNAMENT_ID = '6a0827e7f853d1c1eee4e618';

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── 1. Load tournament ──────────────────────────────────────────────────
    const tournament = await Tournament.findById(TOURNAMENT_ID);
    if (!tournament) { console.error('❌ Tournament not found'); process.exit(1); }

    console.log(`🏆 Tournament: ${tournament.tournamentName}`);
    console.log(`   Status       : ${tournament.status}`);
    console.log(`   Phases       : ${tournament.phases.length}`);
    console.log(`   Stored count : participatingTeamsCount=${tournament.participatingTeamsCount}, slots.registered=${tournament.slots?.registered}\n`);

    const phase = tournament.phases[0];
    if (!phase) { console.error('❌ No phases found'); process.exit(1); }
    console.log(`📋 Only phase: "${phase.name}" (status: ${phase.status})\n`);

    // ── 2. Load all registrations ───────────────────────────────────────────
    const allRegs = await Registration.find({ tournament: TOURNAMENT_ID })
        .populate('team', '_id teamName')
        .lean();

    console.log(`📑 Total registrations in DB: ${allRegs.length}`);

    // ── 3. Check for registrations with null/missing teams ──────────────────
    const orphaned = allRegs.filter(r => !r.team);
    if (orphaned.length > 0) {
        console.log(`⚠️  Found ${orphaned.length} registrations with missing team refs — removing...`);
        await Registration.deleteMany({ _id: { $in: orphaned.map(r => r._id) } });
        console.log(`   ✅ Removed orphaned registrations`);
    }

    // ── 4. Reload after cleanup ─────────────────────────────────────────────
    const regs = await Registration.find({ tournament: TOURNAMENT_ID })
        .populate('team', '_id teamName')
        .lean();

    const approved = regs.filter(r => ['approved', 'checked_in'].includes(r.status));
    const pending = regs.filter(r => r.status === 'pending');
    console.log(`\n📊 After cleanup: ${regs.length} total | ${approved.length} approved | ${pending.length} pending`);

    // ── 5. Fix phase field on approved regs that are missing it ────────────
    const missingPhase = approved.filter(r => !r.phase || r.phase !== phase.name);
    if (missingPhase.length > 0) {
        console.log(`\n🔧 Fixing ${missingPhase.length} approved registration(s) with wrong/missing phase...`);
        await Registration.updateMany(
            { _id: { $in: missingPhase.map(r => r._id) } },
            { $set: { phase: phase.name, currentStage: phase.name } }
        );
        console.log(`   ✅ Phase set to "${phase.name}" on all approved registrations`);
    } else {
        console.log(`   ✅ All approved registrations already have correct phase: "${phase.name}"`);
    }

    // ── 6. Rebuild Tournament.phases[0].teams from registrations ──────────
    const approvedTeamIds = approved.map(r => r.team._id.toString());
    const uniqueTeamIds = [...new Set(approvedTeamIds)];

    // Verify all team IDs actually exist in Team collection
    const existingTeams = await Team.find({ _id: { $in: uniqueTeamIds } }).select('_id').lean();
    const existingTeamIdSet = new Set(existingTeams.map(t => t._id.toString()));
    const validTeamIds = uniqueTeamIds.filter(id => existingTeamIdSet.has(id));
    const invalidTeamIds = uniqueTeamIds.filter(id => !existingTeamIdSet.has(id));

    if (invalidTeamIds.length > 0) {
        console.log(`\n⚠️  Found ${invalidTeamIds.length} registration(s) pointing to non-existent teams — removing...`);
        await Registration.deleteMany({
            tournament: TOURNAMENT_ID,
            team: { $in: invalidTeamIds }
        });
        console.log(`   ✅ Removed stale registrations`);
    }

    // ── 7. Sync phase.teams array ───────────────────────────────────────────
    const currentPhaseTeams = (phase.teams || []).map(t => t.toString());
    const sameSet = 
        validTeamIds.length === currentPhaseTeams.length &&
        validTeamIds.every(id => currentPhaseTeams.includes(id));

    if (!sameSet) {
        console.log(`\n🔧 Syncing Tournament.phases[0].teams...`);
        console.log(`   Was: ${currentPhaseTeams.length} teams → Now: ${validTeamIds.length} teams`);
        await Tournament.updateOne(
            { _id: TOURNAMENT_ID, 'phases._id': phase._id },
            { $set: { 'phases.$.teams': validTeamIds } }
        );
        console.log(`   ✅ Phase teams array synced`);
    } else {
        console.log(`\n   ✅ Tournament.phases[0].teams already correct (${currentPhaseTeams.length} teams)`);
    }

    // ── 8. Sync participatingTeamsCount ─────────────────────────────────────
    const finalApprovedCount = await Registration.countDocuments({
        tournament: TOURNAMENT_ID,
        status: { $in: ['approved', 'checked_in'] }
    });

    const finalTotalCount = await Registration.countDocuments({ tournament: TOURNAMENT_ID });

    const needsCountFix = 
        tournament.participatingTeamsCount !== finalApprovedCount ||
        tournament.slots?.registered !== finalTotalCount;

    if (needsCountFix) {
        console.log(`\n🔧 Fixing tournament counts...`);
        console.log(`   participatingTeamsCount: ${tournament.participatingTeamsCount} → ${finalApprovedCount}`);
        console.log(`   slots.registered: ${tournament.slots?.registered} → ${finalTotalCount}`);
        await Tournament.updateOne(
            { _id: TOURNAMENT_ID },
            { 
                $set: { 
                    participatingTeamsCount: finalApprovedCount,
                    'slots.registered': finalTotalCount
                } 
            }
        );
        console.log(`   ✅ Counts synced`);
    } else {
        console.log(`   ✅ Tournament counts already accurate`);
    }

    // ── 9. Summary ───────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('✨ Consistency fix complete. Final state:');
    console.log(`   Phase            : "${phase.name}"`);
    console.log(`   Teams in phase   : ${validTeamIds.length}`);
    console.log(`   Approved regs    : ${finalApprovedCount}`);
    console.log(`   Total regs       : ${finalTotalCount}`);
    console.log('═══════════════════════════════════════════');

    process.exit(0);
}

run().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
