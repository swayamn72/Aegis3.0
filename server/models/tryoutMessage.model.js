import mongoose from 'mongoose';

const tryoutMessageSchema = new mongoose.Schema(
    {
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TryoutChat',
            required: true,
            index: true,
        },
        sender: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000,
        },
        messageType: {
            type: String,
            enum: ['text', 'system', 'team_offer'],
            default: 'text',
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: undefined,
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

tryoutMessageSchema.index({ chatId: 1, timestamp: 1, _id: 1 });

const TryoutMessage = mongoose.model('TryoutMessage', tryoutMessageSchema);

export default TryoutMessage;
