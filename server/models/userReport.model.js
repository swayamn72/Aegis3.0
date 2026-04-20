import mongoose from 'mongoose';

const reportTargetSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        chatType: {
            type: String,
            enum: ['direct', 'tryout', 'unknown'],
            default: 'unknown',
        },
    },
    { _id: false }
);

const userReportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true,
            index: true,
        },
        target: {
            type: reportTargetSchema,
            required: true,
        },
        reason: {
            type: String,
            enum: [
                'harassment',
                'hate_speech',
                'spam',
                'sexual_content',
                'violence',
                'impersonation',
                'scam_fraud',
                'other',
            ],
            required: true,
        },
        details: {
            type: String,
            trim: true,
            default: '',
            maxlength: 2000,
        },
        status: {
            type: String,
            enum: ['open', 'in_review', 'actioned', 'dismissed'],
            default: 'open',
            index: true,
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
        adminNotes: {
            type: String,
            trim: true,
            default: '',
            maxlength: 2000,
        },
    },
    { timestamps: true }
);

userReportSchema.index({ reporter: 1, 'target.user': 1, createdAt: -1 });
userReportSchema.index({ status: 1, createdAt: -1 });

const UserReport = mongoose.model('UserReport', userReportSchema);
export default UserReport;
