/**
 * Match Room Message Model
 *
 * Stores chat messages for tournament match rooms.
 * Each match has its own room where team members and organizers can chat.
 * Separate from the existing DM/tryout chat system.
 */

import mongoose from 'mongoose';

const matchRoomMessageSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'senderModel',
      required: true,
    },

    // Polymorphic ref — messages can come from players OR org admins
    senderModel: {
      type: String,
      enum: ['Player', 'Organization'],
      required: true,
      default: 'Player',
    },

    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },

    messageType: {
      type: String,
      enum: ['text', 'system', 'veto_update', 'result_update'],
      default: 'text',
    },

    // Optional metadata for system messages (e.g., veto updates)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient room message queries
matchRoomMessageSchema.index({ match: 1, createdAt: 1 });

const MatchRoomMessage = mongoose.model('MatchRoomMessage', matchRoomMessageSchema);
export default MatchRoomMessage;
