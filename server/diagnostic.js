import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Player = mongoose.connection.collection('players');
        const RatingEvent = mongoose.connection.collection('ratingevents');

        const usernames = ['player1ign', 'player56', 'player3', 'username2'];
        for (const username of usernames) {
            const player = await Player.findOne({ username });
            if (!player) {
                console.log(`Player ${username} not found`);
                continue;
            }
            console.log(`\n--- ${username} ---`);
            console.log(`Rating: ${player.aegisRating}`);
            console.log(`Matches: ${player.aegisMatchesRated}`);
            
            const events = await RatingEvent.find({ player: player._id }).toArray();
            console.log(`Events: ${events.length}`);
            events.forEach(e => {
                console.log(`  Match: ${e.match}, Delta: ${e.delta}, Before: ${e.ratingBefore}, After: ${e.ratingAfter}`);
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
};

check();
