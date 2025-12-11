import mongoose from 'mongoose';

const lftPostSchema = new mongoose.Schema({
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
    },
    game: {
        type: String,
        required: true,
        enum: ['VALO', 'CS2', 'BGMI'],
    },
    roles: [{
        type: String,
        enum: ['IGL', 'assaulter', 'support', 'sniper', 'fragger'],
        required: true,
    }],
    region: {
        type: String,
        enum: ['India', 'Asia', 'Europe', 'North America', 'Global'],
        default: 'Global',
    },
    requirements: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    views: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true  // ✅ This automatically adds createdAt and updatedAt
});

// Index for efficient queries
lftPostSchema.index({ game: 1, region: 1, roles: 1, status: 1 });
lftPostSchema.index({ player: 1, status: 1 });
lftPostSchema.index({ createdAt: -1 });

const LFTPost = mongoose.model('LFTPost', lftPostSchema);

export default LFTPost;
