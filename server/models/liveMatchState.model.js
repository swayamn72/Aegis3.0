import mongoose from 'mongoose';

const LIVE_TTL_HOURS = 6;

const livePlayerSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    status: {
      type: String,
      enum: ['alive', 'knocked', 'eliminated'],
      default: 'alive',
    },
  },
  { _id: false }
);

const liveTeamSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    players: [livePlayerSchema],
  },
  { _id: false }
);

const liveMatchStateSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, unique: true, index: true },
    gameTitle: { type: String, default: 'BGMI' },
    teams: [liveTeamSchema],
    lastUpdatedAt: { type: Date, default: Date.now },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + LIVE_TTL_HOURS * 60 * 60 * 1000),
    },
    actionLog: [
      {
        actionType: { type: String, required: true }, // 'knock', 'finish', 'revive', 'eliminate'
        timestamp: { type: Date, default: Date.now },
        payload: { type: mongoose.Schema.Types.Mixed }, // flexible payload
      }
    ],
  },
  { timestamps: true }
);

liveMatchStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('LiveMatchState', liveMatchStateSchema);
