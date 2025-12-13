// scripts/createSampleTournament.js
// Usage: node scripts/createSampleTournament.js
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Tournament from '../models/tournament.model.js';

const MONGO_URI = process.env.MONGO_URI;

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const sampleTournament = {
        tournamentName: 'Aegis Invitational 2025',
        shortName: 'AegisInv2025',
        gameTitle: 'BGMI',
        tier: 'A',
        region: 'India',
        organizer: {
            name: 'Aegis Esports',
            website: 'https://aegisesports.com',
            contactEmail: 'info@aegisesports.com',
        },
        startDate: new Date('2025-12-20T10:00:00Z'),
        endDate: new Date('2025-12-25T18:00:00Z'),
        format: 'Battle Royale Points System',
        slots: {
            total: 32,
            invited: 8,
            openRegistrations: 24,
            registered: 0,
        },
        phases: [
            {
                name: 'Qualifiers',
                type: 'qualifiers',
                startDate: new Date('2025-12-20T10:00:00Z'),
                endDate: new Date('2025-12-22T18:00:00Z'),
                status: 'upcoming',
                matches: [],
                teams: [],
                groups: [],
                qualificationRules: [
                    { numberOfTeams: 16, source: 'overall', nextPhase: 'Finals' },
                ],
            },
            {
                name: 'Finals',
                type: 'final_stage',
                startDate: new Date('2025-12-23T10:00:00Z'),
                endDate: new Date('2025-12-25T18:00:00Z'),
                status: 'upcoming',
                matches: [],
                teams: [],
                groups: [],
                qualificationRules: [],
            },
        ],
        prizePool: {
            total: 1000000,
            currency: 'INR',
            distribution: [
                { position: '1st', amount: 500000 },
                { position: '2nd', amount: 300000 },
                { position: '3rd', amount: 200000 },
            ],
            individualAwards: [
                {
                    name: 'MVP',
                    description: 'Most Valuable Player',
                    amount: 50000,
                },
            ],
        },
        description: 'A sample tournament for testing and development.',
        websiteLink: 'https://aegisesports.com/invitational2025',
        gameSettings: {
            serverRegion: 'Asia',
            gameMode: 'TPP Squad',
            maps: ['Erangel', 'Miramar'],
            pointsSystem: {},
        },
        visibility: 'public',
        featured: true,
        verified: false,
        tags: ['sample', 'test', 'aegis'],
    };

    try {
        const created = await Tournament.create(sampleTournament);
        console.log('Sample tournament created:', created);
    } catch (err) {
        console.error('Error creating sample tournament:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
