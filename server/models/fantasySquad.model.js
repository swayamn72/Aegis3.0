import mongoose from 'mongoose';

const fantasySquadSchema = new mongoose.Schema(
  {
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyContest', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    squadName: { type: String, trim: true, maxlength: 50, default: 'My Squad' },
    players: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
        team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        role: { type: String, enum: ['captain', 'vice_captain', 'player'], default: 'player' },
        cost: { type: Number, required: true },
        pointsEarned: { type: Number, default: 0 },
        matchPoints: [{ match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' }, points: { type: Number, default: 0 } }],
      },
    ],
    totalPoints: { type: Number, default: 0, index: true },
    rank: { type: Number, default: null, index: true },
    budgetUsed: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'locked', 'scored'], default: 'active' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// One squad per user per contest
fantasySquadSchema.index({ contest: 1, user: 1 }, { unique: true });
fantasySquadSchema.index({ contest: 1, totalPoints: -1 });

const FantasySquad = mongoose.model('FantasySquad', fantasySquadSchema);
export default FantasySquad;
