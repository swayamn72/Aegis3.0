import mongoose from 'mongoose';

const lfpSwipeSchema = new mongoose.Schema(
    {
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LFPPost',
            required: true,
            index: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            index: true,
        },
        action: {
            type: String,
            enum: ['left', 'right'],
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

lfpSwipeSchema.index({ player: 1, post: 1 }, { unique: true });
lfpSwipeSchema.index({ player: 1, action: 1, updatedAt: -1 });

const LFPSwipe = mongoose.model('LFPSwipe', lfpSwipeSchema);

export default LFPSwipe;
