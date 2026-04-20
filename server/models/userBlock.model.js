import mongoose from 'mongoose';

const userBlockSchema = new mongoose.Schema(
    {
        blocker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        blocked: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        reason: {
            type: String,
            trim: true,
            default: '',
            maxlength: 500,
        },
    },
    { timestamps: true }
);

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const UserBlock = mongoose.model('UserBlock', userBlockSchema);
export default UserBlock;
