import mongoose from 'mongoose';
import Registration from './models/registration.model.js';
import Tournament from './models/tournament.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const tournaments = await Tournament.find({}).limit(5);
    for (const t of tournaments) {
        console.log(`\nTournament: ${t.tournamentName} (${t._id})`);
        for (const p of t.phases) {
            console.log(`  Phase: "${p.name}"`);
            for (const g of p.groups) {
                const count = await Registration.countDocuments({
                    tournament: t._id,
                    phase: p.name,
                    group: g.name,
                    status: { $in: ['approved', 'checked_in'] }
                });
                console.log(`    Group: "${g.name}" -> Registrations Count: ${count}`);
            }
        }

        // Check if any registrations have DIFFERENT phase names
        const regs = await Registration.find({ tournament: t._id }).limit(10);
        if (regs.length > 0) {
            console.log('  Sample Registrations:');
            regs.forEach(r => {
                console.log(`    Team: ${r.team}, Phase: "${r.phase}", Group: "${r.group}", Status: ${r.status}`);
            });
        }
    }

    process.exit(0);
}

check();
