import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const resetAll = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔗 Connected to DB');

        const Player = mongoose.connection.collection('players');
        const RatingEvent = mongoose.connection.collection('ratingevents');

        // 1. Reset all player rating fields
        const playerResult = await Player.updateMany(
            {},
            {
                $set: {
                    aegisRating: 1000,
                    aegisRatingPeak: 1000,
                    aegisRatingFloor: 0,
                    aegisPrestigeFloor: 0,
                    aegisMatchesRated: 0,
                    aegisIsProvisional: true,
                    aegisLastRatedMatchAt: null
                }
            }
        );
        console.log(`✅ Reset ${playerResult.modifiedCount} player documents to 1000.`);

        // 2. Clear RatingEvent history
        const eventResult = await RatingEvent.deleteMany({});
        console.log(`✅ Deleted ${eventResult.deletedCount} rating event records.`);

        console.log('🎉 Reset complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Reset failed:', err);
        process.exit(1);
    }
};

resetAll();
