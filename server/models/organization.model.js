import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    orgName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    orgSocial: {
      instagram: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
      facebook: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },

      website: { type: String, trim: true, default: '' },
    },
    ownerSocial: {
      instagram: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
      facebook: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },

      website: { type: String, trim: true, default: '' },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    googleId: {
      type: String,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: false, // Not required for Google OAuth users
      select: false,
    },
    country: {
      type: String,
      trim: true,
      required: true,
    },
    headquarters: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    agreedToGuidelines: {
      type: Boolean,
      default: false,
    },
    guidelinesAcceptedAt: {
      type: Date,
      default: null,
    },
    logo: {
      type: String,
      trim: true,
      default: '',
    },
    establishedDate: {
      type: Date,
      default: Date.now,
    },
    activeGames: [
      {
        type: String,
        enum: ['BGMI', 'VALO', 'CS2'],
      },
    ],
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    // Admin approval fields
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    approvalDate: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    // Verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
    },
    verificationCodeAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lastVerificationEmailSent: {
      type: Date,
      select: false,
    },
    // Password reset
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpiry: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
    // Progress flags
    profileCustomized: {
      type: Boolean,
      default: true, // Existing organizations are assumed complete; Google ones will set it to false
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries on approval status
organizationSchema.index({ approvalStatus: 1, createdAt: -1 });

// Method to check if organization can login
organizationSchema.methods.canLogin = function () {
  return this.approvalStatus === 'approved' && this.isEmailVerified;
};

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
