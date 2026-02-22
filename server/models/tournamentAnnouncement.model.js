import mongoose from 'mongoose';

const tournamentAnnouncementSchema = new mongoose.Schema(
    {
        tournamentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true,
            index: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        // 'general'        → shown to everyone on tournament page, no DM
        // 'specific_teams' → DM sent to all players on chosen teams
        // 'phase'          → DM sent to all players whose team is in that phase
        // 'group'          → DM sent to all players whose team is in that group of that phase
        targetType: {
            type: String,
            enum: ['general', 'specific_teams', 'phase', 'group'],
            required: true,
            default: 'general',
        },
        targetTeams: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team',
            },
        ],
        targetPhase: {
            type: String,
            trim: true,
        },
        targetGroup: {
            type: String,
            trim: true,
        },
        // How many DMs were dispatched (for org reference)
        dmsSent: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

tournamentAnnouncementSchema.index({ tournamentId: 1, createdAt: -1 });

const TournamentAnnouncement = mongoose.model(
    'TournamentAnnouncement',
    tournamentAnnouncementSchema
);

export default TournamentAnnouncement;
