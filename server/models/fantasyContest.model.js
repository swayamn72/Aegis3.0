import mongoose from 'mongoose';

const fantasyContestSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    phase: { type: String, trim: true, required: true },
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    featuredImage: { type: String, default: '' },

    // Entry — free now, future-proofed for paid
    entryType: { type: String, enum: ['free', 'coins', 'premium'], default: 'free', index: true },
    entryFee: { amount: { type: Number, default: 0, min: 0 }, currency: { type: String, default: 'INR' } },
    prizePool: {
      total: { type: Number, default: 0 },
      distribution: [{ position: String, amount: Number, percentage: Number }],
    },

    // Squad rules
    maxSquads: { type: Number, default: 1000, min: 1 },
    currentSquads: { type: Number, default: 0 },
    maxSquadsPerUser: { type: Number, default: 1 },
    squadSize: { type: Number, default: 4 },
    maxFromSameTeam: { type: Number, default: 2 },
    budgetCap: { type: Number, default: 100 },

    // Status
    status: { type: String, enum: ['draft', 'upcoming', 'live', 'scoring', 'completed', 'cancelled'], default: 'draft', index: true },
    lockTime: { type: Date, required: true, index: true },

    // Scoring system (customizable per contest)
    scoringSystem: {
      killPoints: { type: Number, default: 1 },
      threeKillBonus: { type: Number, default: 1 },
      fiveKillBonus: { type: Number, default: 2 },
      chickenDinner: { type: Number, default: 5 },
      topThree: { type: Number, default: 3 },
      topFive: { type: Number, default: 2 },
      topEight: { type: Number, default: 1 },
      zeroKillPenalty: { type: Number, default: -1 },
      captainMultiplier: { type: Number, default: 2 },
      viceCaptainMultiplier: { type: Number, default: 1.5 },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

fantasyContestSchema.index({ tournament: 1, phase: 1 });
fantasyContestSchema.index({ status: 1, lockTime: 1 });
fantasyContestSchema.index({ entryType: 1, status: 1 });

fantasyContestSchema.virtual('isLocked').get(function () {
  return new Date() >= this.lockTime;
});

fantasyContestSchema.virtual('isFull').get(function () {
  return this.currentSquads >= this.maxSquads;
});

const FantasyContest = mongoose.model('FantasyContest', fantasyContestSchema);
export default FantasyContest;
