import mongoose from 'mongoose';

const lfpPostSchema = new mongoose.Schema({
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
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
    openRoles: [{
        type: String,
        enum: ['IGL', 'Assaulter', 'Support', 'Sniper', 'Fragger'],
        required: true,
    }],
    region: {
        type: String,
        enum: ['India', 'Asia', 'Europe', 'North America', 'Global'],
        default: 'India',
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
    timestamps: true
});

// Index for efficient queries
lfpPostSchema.index({ game: 1, region: 1, openRoles: 1, status: 1 });
lfpPostSchema.index({ team: 1, status: 1 });
lfpPostSchema.index({ createdAt: -1 });
lfpPostSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 2592000 }); // Expire after 30 days of inactivity


const LFPPost = mongoose.model('LFPPost', lfpPostSchema);

export default LFPPost;
