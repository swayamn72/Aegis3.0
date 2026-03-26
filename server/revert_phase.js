import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const revertPhase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const tournamentId = '69a6fce25061f0d80c2ab07f';
        const phaseName = 'Round 2';
        const nextPhaseName = 'Round 3';

        // 1. Fetch Tournament
        const Tournament = mongoose.connection.collection('tournaments');
        const Registration = mongoose.connection.collection('registrations');
        const PhaseStanding = mongoose.connection.collection('phasestandings');

        const tournament = await Tournament.findOne({ _id: new mongoose.Types.ObjectId(tournamentId) });
        if (!tournament) {
            console.error('Tournament not found');
            return;
        }

        // 2. Revert Round 2 Status
        const round2Index = tournament.phases.findIndex(p => p.name === phaseName);
        if (round2Index !== -1) {
            tournament.phases[round2Index].status = 'in_progress';
        }

        // 3. Revert Round 3 Teams
        const round3Index = tournament.phases.findIndex(p => p.name === nextPhaseName);
        let teamsToRevert = [];
        if (round3Index !== -1) {
            teamsToRevert = tournament.phases[round3Index].teams || [];
            tournament.phases[round3Index].teams = [];
            tournament.phases[round3Index].status = 'upcoming'; // or whatever it was
        }

        // Save Tournament changes
        await Tournament.updateOne(
            { _id: new mongoose.Types.ObjectId(tournamentId) },
            { $set: { phases: tournament.phases } }
        );
        console.log('✅ Reverted Tournament phases status and advanced teams');

        // 4. Revert Registrations
        const updateResult = await Registration.updateMany(
            {
                tournament: new mongoose.Types.ObjectId(tournamentId),
                phase: nextPhaseName
            },
            {
                $set: {
                    phase: phaseName,
                    currentStage: phaseName
                }
            }
        );
        console.log(`✅ Reverted ${updateResult.modifiedCount} Registrations from ${nextPhaseName} back to ${phaseName}`);

        // 5. Delete PhaseStanding for Round 2
        const deleteResult = await PhaseStanding.deleteOne({
            tournament: new mongoose.Types.ObjectId(tournamentId),
            phase: phaseName
        });
        console.log(`✅ Deleted PhaseStanding for ${phaseName} - Deleted: ${deleteResult.deletedCount}`);

        console.log('🎉 Revert complete. You can now reliably attempt "Advance Phase" again.');
    } catch (err) {
        console.error('❌ Error during revert:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

revertPhase();
