import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

/**
 * RatingEvent — stores one document per player per match.
 * Replaces any need for embedded rating history arrays in Player.
 */
const ratingEventSchema = new mongoose.Schema(
  {
    player:          { type: ObjectId, ref: 'Player',     required: true },
    match:           { type: ObjectId, ref: 'Match',      required: true },
    tournament:      { type: ObjectId, ref: 'Tournament', required: true },
    delta:           { type: Number,   required: true },
    ratingBefore:    { type: Number,   required: true },
    ratingAfter:     { type: Number,   required: true },
    mps:             Number,
    tw:              Number,
    k:               Number,
    tier:            String,
    importanceScore: Number,
    phaseMultiplier: Number,
    cappedReason:    { type: String, default: null },  // null | 'match_cap' | 'tournament_cap'
    ratingSource:    { type: String, enum: ['normal', 'seeded'], default: 'normal' },
    date:            { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Query patterns
ratingEventSchema.index({ player: 1, date: -1 });            // rating history page
ratingEventSchema.index({ match: 1 });                       // match reversal
ratingEventSchema.index({ player: 1, match: 1 }, { unique: true }); // idempotency
ratingEventSchema.index({ tournament: 1, player: 1 });       // per-tournament cumulative delta

export default mongoose.model('RatingEvent', ratingEventSchema);
