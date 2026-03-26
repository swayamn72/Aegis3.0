import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const analyzeMatch = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const RatingEvent = mongoose.connection.collection('ratingevents');
        const matchIdString = '69c016aa5004b2b9543d5743';
        const matchId = new mongoose.Types.ObjectId(matchIdString);

        const events = await RatingEvent.find({ match: matchId }).toArray();
        if (events.length === 0) {
            console.log('No rating events found for this match.');
            return;
        }

        const deltas = events.map(e => e.delta);
        const maxPlus = Math.max(...deltas.filter(d => d > 0), 0);
        const maxMinus = Math.min(...deltas.filter(d => d < 0), 0);
        const minDelta = Math.min(...deltas.map(d => Math.abs(d)));

        console.log(`\n--- Match Analysis for ${matchIdString} ---`);
        console.log(`Total Rated Players: ${events.length}`);
        console.log(`Max Positive Delta (+): ${maxPlus}`);
        console.log(`Max Negative Delta (-): ${maxMinus}`);
        console.log(`Min Absolute Delta (closest to 0): ${minDelta}`);
        
        // Find players associated with these
        const topGainer = events.find(e => e.delta === maxPlus);
        const topLoser = events.find(e => e.delta === maxMinus);
        
        console.log(`\nTop Gainer ID: ${topGainer?.player} (+${topGainer?.delta})`);
        console.log(`Top Loser ID: ${topLoser?.player} (${topLoser?.delta})`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
};

analyzeMatch();
