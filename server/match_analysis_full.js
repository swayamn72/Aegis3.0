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
        const Player = mongoose.connection.collection('players');
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
        
        console.log(`\n--- Full Match Analysis (Match: ${matchIdString}) ---`);
        console.log(`Total Rated Players: ${events.length}`);
        
        const topGainerEvent = events.find(e => e.delta === maxPlus);
        const topLoserEvent = events.find(e => e.delta === maxMinus);
        
        const topGainer = await Player.findOne({ _id: topGainerEvent.player });
        const topLoser = await Player.findOne({ _id: topLoserEvent.player });

        console.log(`Max Gain: +${maxPlus} (${topGainer?.username || 'Unknown'})`);
        console.log(`Max Loss: ${maxMinus} (${topLoser?.username || 'Unknown'})`);
        
        const zeroChanges = events.filter(e => e.delta === 0).length;
        console.log(`Players with 0 change: ${zeroChanges}`);

        // Average delta
        const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        console.log(`Average Delta: ${avgDelta.toFixed(2)}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
};

analyzeMatch();
