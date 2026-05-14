import mongoose from 'mongoose';

/**
 * ResultSubmission
 *
 * A team submits a scoreboard screenshot after their Valorant match.
 * An org admin verifies it and either approves (which triggers match result update)
 * or disputes it.
 *
 * States: pending → ocr_processed → (approved | disputed)
 */
const resultSubmissionSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      index: true,
    },
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    submittedByTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    submittedByPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },

    // Screenshot URLs (uploaded to Cloudinary)
    screenshots: [{
      url: { type: String, required: true },
      label: { type: String }, // e.g. "Map 1 Scoreboard", "End Screen"
      uploadedAt: { type: Date, default: Date.now },
    }],

    // OCR-parsed data (filled by valorantOcr.service.js)
    ocrData: {
      processed: { type: Boolean, default: false },
      processedAt: { type: Date },
      confidence: { type: Number }, // 0–1 overall confidence
      rawText: { type: String },    // raw Tesseract output (debug)
      parsedResult: {
        winner: { type: String },   // 'teamA' | 'teamB'
        scoreA: { type: Number },
        scoreB: { type: Number },
        totalRounds: { type: Number },
        playerStats: [{
          playerName: { type: String },
          team: { type: String },   // 'teamA' | 'teamB'
          agent: { type: String },
          kills: { type: Number },
          deaths: { type: Number },
          assists: { type: Number },
          acs: { type: Number },
          adr: { type: Number },
        }],
      },
      errors: [{ type: String }],   // any parsing warnings
    },

    // Manual override (if org admin edits the parsed data)
    manualResult: {
      winner: { type: String },     // 'teamA' | 'teamB'
      scoreA: { type: Number },
      scoreB: { type: Number },
      notes: { type: String },
    },

    status: {
      type: String,
      enum: ['pending', 'ocr_processed', 'approved', 'disputed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Org admin review
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },

    // For dispute resolution
    disputeRaisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    disputeReason: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

resultSubmissionSchema.index({ match: 1, submittedByTeam: 1 });
resultSubmissionSchema.index({ status: 1, tournament: 1 });

const ResultSubmission = mongoose.model('ResultSubmission', resultSubmissionSchema);
export default ResultSubmission;
