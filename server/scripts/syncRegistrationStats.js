import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';

async function syncRegistrations() {
    try {
        await connectDB();
        console.log('🔗 Connected to DB');

        // Aggregate ALL match results per team/tournament
        console.log('Aggregating match results from completed and in-progress matches...');
        const stats = await Match.aggregate([
            { $match: { status: { $in: ['completed', 'in_progress'] } } },
            { $unwind: '$results' },
            {
                $group: {
                    _id: {
                        team: '$results.team',
                        tournament: '$tournament'
                    },
                    totalPoints: { $sum: { $ifNull: ['$results.points.totalPoints', 0] } },
                    totalKills: { $sum: { $ifNull: ['$results.kills.total', 0] } },
                    matchesPlayed: { $sum: 1 }
                }
            }
        ]);

        console.log(`Found ${stats.length} team-tournament result pairs.`);

        if (stats.length === 0) {
            console.log('No completed match results found to sync.');
            process.exit(0);
        }

        const bulkOps = stats.map(stat => ({
            updateOne: {
                filter: {
                    team: stat._id.team,
                    tournament: stat._id.tournament,
                    status: { $in: ['approved', 'checked_in', 'withdrawn', 'disqualified', 'completed'] }
                },
                update: {
                    $set: {
                        totalTournamentPoints: stat.totalPoints,
                        totalTournamentKills: stat.totalKills,
                        matchesPlayed: stat.matchesPlayed
                    }
                }
            }
        }));

        const result = await Registration.bulkWrite(bulkOps, { ordered: false });
        console.log(`Successfully synced ${result.modifiedCount} registrations.`);
        console.log('🎉 Sync complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

syncRegistrations();
