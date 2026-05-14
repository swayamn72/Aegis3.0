import mongoose from 'mongoose';

const fantasyPlayerPoolSchema = new mongoose.Schema(
  {
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyContest', required: true, index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    displayName: { type: String, required: true, trim: true },
    teamTag: { type: String, trim: true, default: '' },
    inGameRole: { type: String, trim: true, default: '' },
    profilePicture: { type: String, default: '' },
    cost: { type: Number, required: true, min: 1 },
    recentForm: {
      avgKills: { type: Number, default: 0 },
      avgPoints: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
    },
    selectionCount: { type: Number, default: 0 },
    selectionPercentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

fantasyPlayerPoolSchema.index({ contest: 1, player: 1 }, { unique: true });
fantasyPlayerPoolSchema.index({ contest: 1, cost: 1 });
fantasyPlayerPoolSchema.index({ contest: 1, team: 1 });

const FantasyPlayerPool = mongoose.model('FantasyPlayerPool', fantasyPlayerPoolSchema);
export default FantasyPlayerPool;
