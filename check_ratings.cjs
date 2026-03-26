const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const checkEvents = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected');

        const Player = mongoose.connection.collection('players');
        const RatingEvent = mongoose.connection.collection('ratingevents');

        const usernames = ['player1ign', 'player56', 'player3', 'username2'];
        
        for (const uname of usernames) {
            const player = await Player.findOne({ username: uname });
            if (!player) {
                console.log(`Player ${uname} not found`);
                continue;
            }

            console.log(`--- ${uname} ---`);
            console.log(`Current Rating: ${player.aegisRating}`);
            console.log(`Matches Rated: ${player.aegisMatchesRated}`);
            console.log(`Prestige Floor: ${player.aegisPrestigeFloor}`);
            
            const events = await RatingEvent.find({ player: player._id }).toArray();
            console.log(`Events Found: ${events.length}`);
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

checkEvents();
