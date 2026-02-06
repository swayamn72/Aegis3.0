
import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    inGameName: {
      type: String,
      trim: true,
    },
    realName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: false, // Not required for Google OAuth users
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values, only enforces uniqueness for non-null
    },
    authProvider: {
      type: [String],
      enum: ['local', 'google'],
      default: ['local'],
      // Can have both: ['local', 'google'] if user links accounts
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpiry: {
      type: Date,
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false, // Don't include in queries by default
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
    },
    usernameCustomized: {
      type: Boolean,
      default: true, // true for regular signup, false for Google OAuth until they customize
    },
    country: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      default: '',
    },
    profilePicture: {
      type: String,
      trim: true,
      default: '',
    },
    fcmToken: {
      type: String,
      default: null,
    },
    primaryGame: {
      type: String,
      enum: ['BGMI', 'VALO', 'CS2'],
    },
    earnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    inGameRole: [
      {
        type: String,
        enum: ['assaulter', 'IGL', 'support', 'filter', 'sniper'],
      },
    ],
    location: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      min: 13,
      max: 99,
    },
    languages: [
      {
        type: String,
      },
    ],
    aegisRating: {
      type: Number,
      default: 0,
    },
    tournamentsPlayed: {
      type: Number,
      default: 0,
    },
    matchesPlayed: {
      type: Number,
      default: 0,
    },
    statistics: {
      tournamentsPlayed: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      totalKills: { type: Number, default: 0 },
      averagePlacement: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
    },
    qualifiedEvents: {
      type: Boolean,
      default: false,
    },
    qualifiedEventDetails: [
      {
        type: String,
      },
    ],
    teamStatus: {
      type: String,
      enum: ['looking for a team', 'in a team', 'open for offers'],
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    previousTeams: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        startDate: Date,
        endDate: Date,
        reason: {
          type: String,
          enum: ['left', 'removed', 'team disbanded', 'transferred'],
        },
      },
    ],
    availability: {
      type: String,
      enum: ['weekends only', 'evenings', 'flexible', 'full time'],
    },
    discordTag: {
      type: String,
      trim: true,
      default: '',
    },
    twitch: {
      type: String,
      trim: true,
      default: '',
    },
    youtube: {
      type: String,
      trim: true,
      default: '',
    },
    twitter: {
      type: String,
      trim: true,
      default: '',
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    cardTheme: {
      type: String,
      enum: ['orange', 'blue', 'purple', 'red', 'green', 'pink'],
      default: 'orange',
    },
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastCheckIn: {
      type: Date,
      default: null,
    },
    checkInStreak: {
      type: Number,
      default: 0,
    },
    totalCheckIns: {
      type: Number,
      default: 0,
    },
    rewardsHistory: [
      {
        type: {
          type: String,
          enum: ["daily_checkin", "tournament_join", "streak_bonus", "other"],
        },
        amount: Number,
        date: {
          type: Date,
          default: Date.now,
        },
        description: String,
      },
    ],
    posts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    receivedRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
  },
  {
    timestamps: true,
  }
);

const Player = mongoose.model('Player', playerSchema);

export default Player;