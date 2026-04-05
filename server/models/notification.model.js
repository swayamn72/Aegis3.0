import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    sender: {
      type: String,
      default: 'system',
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['match_scheduled', 'room_credentials', 'team_offer', 'recruitment_approach', 'team_application', 'tryout_started', 'tryout_ended', 'offer_accepted', 'offer_rejected', 'approach_rejected', 'chat_message', 'tryout_chat_message', 'system', 'test'],
      default: 'system',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000, // Automatic deletion after 30 days (30 * 24 * 60 * 60 seconds)
    },
  },
  {
    timestamps: true,
  }
);

// Index for fetching notifications for a user, sorted by newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
