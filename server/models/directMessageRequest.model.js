import mongoose from 'mongoose';

const directMessageRequestSchema = new mongoose.Schema(
    {
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'cancelled'],
            default: 'pending',
            index: true,
        },
        initialMessage: {
            type: String,
            trim: true,
            default: '',
            maxlength: 500,
        },
        respondedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

directMessageRequestSchema.index(
    { requester: 1, recipient: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'pending' },
    }
);

directMessageRequestSchema.index({ requester: 1, recipient: 1, createdAt: -1 });

const DirectMessageRequest = mongoose.model('DirectMessageRequest', directMessageRequestSchema);
export default DirectMessageRequest;
