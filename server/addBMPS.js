import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Emulate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

import Tournament from './models/tournament.model.js';

async function seedBMPS2026() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const bmps = new Tournament({
      tournamentName: 'Battlegrounds Mobile Pro Series 2026',
      shortName: 'BMPS 2026',
      slug: 'battlegrounds-mobile-pro-series-2026',
      gameTitle: 'BGMI',
      tier: 'A', // Updated to Tier A per user request
      region: 'India',
      organizer: {
        name: 'Krafton India'
      },
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-09-30'),
      status: 'announced',
      format: 'Battle Royale Points System',
      slots: {
        total: 64
      },
      prizePool: {
        total: 20000000,
        currency: 'INR',
        distribution: [
          { position: '1st', amount: 6000000 },
          { position: '2nd', amount: 3000000 },
          { position: '3rd', amount: 2000000 },
          { position: '4th', amount: 1500000 },
          { position: '5th', amount: 1250000 },
          { position: '6th', amount: 900000 },
          { position: '7th', amount: 750000 },
          { position: '8th', amount: 750000 },
          { position: '9th', amount: 500000 },
          { position: '10th', amount: 500000 },
          { position: '11th', amount: 400000 },
          { position: '12th', amount: 400000 },
          { position: '13th', amount: 300000 },
          { position: '14th', amount: 300000 },
          { position: '15th', amount: 250000 },
          { position: '16th', amount: 250000 }
        ],
        individualAwards: [
          { name: 'MVP', amount: 400000 },
          { name: 'FINALE MVP', amount: 200000 },
          { name: 'BEST IGL', amount: 250000 },
          { name: 'BEST CLUTCH', amount: 100000 }
        ]
      },
      phases: [
        {
          name: 'Qualifiers Round 1',
          type: 'qualifiers',
          status: 'upcoming',
          details: '64 Teams divided into 4 Groups. Each Group will play 6 Matches. Promotions & Relegations: Group A ↔ B (Bottom 4 A to B, Top 4 B to A), Group B ↔ C (Bottom 4 B to C, Top 4 C to B), Group C ↔ D (Bottom 4 C to D, Top 4 D to C).',
          groups: [{ name: 'Group A' }, { name: 'Group B' }, { name: 'Group C' }, { name: 'Group D' }],
          qualificationRules: [
            { numberOfTeams: 16, source: 'from_each_group', nextPhase: 'Qualifiers Round 2' }
          ]
        },
        {
          name: 'Qualifiers Round 2',
          type: 'qualifiers',
          status: 'upcoming',
          details: 'Newly Formed Groups after promotion & relegations, will play 6 matches this week. Promotions & Relegations logic continues: A ↔ B, B ↔ C, C ↔ D.',
          groups: [{ name: 'Group A' }, { name: 'Group B' }, { name: 'Group C' }, { name: 'Group D' }],
          qualificationRules: [
            { numberOfTeams: 16, source: 'from_each_group', nextPhase: 'Qualifiers Round 3' }
          ]
        },
        {
          name: 'Qualifiers Round 3',
          type: 'qualifiers',
          status: 'upcoming',
          details: 'Newly Formed Groups after promotion & relegations, will play 6 matches this week. Promotions & Relegations logic continues: A ↔ B, B ↔ C, C ↔ D.',
          groups: [{ name: 'Group A' }, { name: 'Group B' }, { name: 'Group C' }, { name: 'Group D' }],
          qualificationRules: [
            { numberOfTeams: 16, source: 'from_each_group', nextPhase: 'Qualifiers Round 4' }
          ]
        },
        {
          name: 'Qualifiers Round 4',
          type: 'qualifiers',
          status: 'upcoming',
          details: 'Newly Formed Groups after promotion & relegations, will play 6 matches this week. Seeding: Group A (Top 8 to Finals, Bottom 8 to Semi Finals), Group B (Top 8 to Semi Finals, Bottom 8 to Survival Stage), Group C (All 16 to Survival Stage), Group D (Top 8 to Survival Stage, Bottom 8 eliminated).',
          groups: [{ name: 'Group A' }, { name: 'Group B' }, { name: 'Group C' }, { name: 'Group D' }],
          qualificationRules: [
            { numberOfTeams: 8, source: 'overall', nextPhase: 'Grand Finals' },
            { numberOfTeams: 16, source: 'overall', nextPhase: 'Semi Finals' },
            { numberOfTeams: 32, source: 'overall', nextPhase: 'Survival Stage' }
          ]
        },
        {
          name: 'Survival Stage',
          type: 'group_stage',
          status: 'upcoming',
          details: '32 Teams. Divided into 4 Groups of 8 Teams. Round Robin Format over 4 days. Each Team plays 12 Matches. Top 8 qualify for Semi Finals, rest 24 eliminated.',
          groups: [{ name: 'Group 1' }, { name: 'Group 2' }, { name: 'Group 3' }, { name: 'Group 4' }],
          qualificationRules: [
            { numberOfTeams: 8, source: 'overall', nextPhase: 'Semi Finals' }
          ]
        },
        {
          name: 'Semi Finals',
          type: 'playoffs',
          status: 'upcoming',
          details: '24 Teams. Divided into 3 Groups of 8 Teams. Double Round Robin Format over 4 days. Each Team plays 16 Matches. Top 6 to Finals, #7 to #22 to Last Chance, Bottom 2 eliminated.',
          groups: [{ name: 'Group A' }, { name: 'Group B' }, { name: 'Group C' }],
          qualificationRules: [
            { numberOfTeams: 6, source: 'overall', nextPhase: 'Grand Finals' },
            { numberOfTeams: 16, source: 'overall', nextPhase: 'Last Chance' }
          ]
        },
        {
          name: 'Last Chance',
          type: 'playoffs',
          status: 'upcoming',
          details: '16 Teams from Semi Finals. 2 Days. Each Team plays 12 Matches (6/day). Top 2 to Finals, Bottom 14 eliminated.',
          groups: [{ name: 'Main Group' }],
          qualificationRules: [
            { numberOfTeams: 2, source: 'overall', nextPhase: 'Grand Finals' }
          ]
        },
        {
          name: 'Grand Finals',
          type: 'final_stage',
          status: 'upcoming',
          details: '16 Teams. 3 Days. 18 Matches.',
          groups: [{ name: 'Main Group' }]
        }
      ]
    });

    // Delete if already exists
    await Tournament.deleteOne({ slug: 'battlegrounds-mobile-pro-series-2026' });

    await bmps.save();
    console.log('BMPS 2026 successfully inserted into the database!');
    process.exit(0);
  } catch (error) {
    console.error('Error inserting tournament:', error);
    process.exit(1);
  }
}

seedBMPS2026();
