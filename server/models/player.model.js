
import mongoose from 'mongoose';
import { SUPPORTED_GAMES, getAllRoles } from '../config/gameRegistry.js';

const playerSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    // Game IDs - Player can have IDs for multiple games
    gameIds: [
      {
        game: {
          type: String,
          enum: SUPPORTED_GAMES,
          default: 'BGMI',
        },
        inGameName: {
          type: String,
          required: true,
          trim: true,
        },
        characterId: {
          type: String,
          trim: true,
        },
        riotId: {
          type: String,    // Valorant Riot ID (Name#Tag)
          trim: true,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastUpdatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    gameIdUpdateHistory: [
      {
        updateDate: {
          type: Date,
          default: Date.now,
        },
        oldGameId: {
          inGameName: String,
          characterId: String,
        },
        newGameId: {
          inGameName: String,
          characterId: String,
        },
      },
    ],
    lastGameIdUpdate: {
      type: Date,
      default: null,
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
      select: false, // CRITICAL: Don't expose password in queries
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
    deleteAccountToken: {
      type: String,
      default: null,
    },
    deleteAccountExpiry: {
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
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
    usernameCustomized: {
      type: Boolean,
      default: true, // true for regular signup, false for Google OAuth until they customize
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    bio: {
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
    profilePicture: {
      type: String,
      trim: true,
      default: '',
    },
    fcmToken: {
      type: String,
      default: null,
    },
    notificationPreferences: {
      enabled: { type: Boolean, default: true },
      directMessages: { type: Boolean, default: true },
      tryoutMessages: { type: Boolean, default: true },
      eventNotifications: { type: Boolean, default: true },
    },
    mutedTryoutChats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TryoutChat',
      },
    ],
    primaryGame: {
      type: String,
      enum: SUPPORTED_GAMES,
    },
    earnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    inGameRole: [
      {
        type: String,
        enum: [
          // BGMI roles
          'IGL', 'Assaulter', 'Fragger', 'Support', 'Sniper', 'Substitute', 'Player',
          // Valorant roles
          'Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex',
        ],
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
      default: 1000,
    },
    aegisRatingPeak: { type: Number, default: 1000 },
    aegisRatingFloor: { type: Number, default: 0 },
    aegisPrestigeFloor: { type: Number, default: 0 },
    aegisMatchesRated: { type: Number, default: 0 },
    aegisIsProvisional: { type: Boolean, default: true },
    aegisLastRatedMatchAt: { type: Date, default: null },
    sChampionships: { type: Number, default: 0 },
    aChampionships: { type: Number, default: 0 },
    sTopThree: { type: Number, default: 0 },
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

    // --- Valorant Rating (parallel to aegisRating for BGMI) ---
    valRating: { type: Number, default: 1000 },
    valRatingPeak: { type: Number, default: 1000 },
    valRatingFloor: { type: Number, default: 0 },
    valPrestigeFloor: { type: Number, default: 0 },
    valMatchesRated: { type: Number, default: 0 },
    valIsProvisional: { type: Boolean, default: true },
    valLastRatedMatchAt: { type: Date, default: null },

    // --- Valorant Stats ---
    valorantStats: {
      tournamentsPlayed: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      totalKills: { type: Number, default: 0 },
      totalDeaths: { type: Number, default: 0 },
      totalAssists: { type: Number, default: 0 },
      kd: { type: Number, default: 0 },
      avgAcs: { type: Number, default: 0 },
      avgAdr: { type: Number, default: 0 },
      totalClutches: { type: Number, default: 0 },
      totalFirstKills: { type: Number, default: 0 },
      totalAces: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
    },

    // --- Riot API Profile Data (cached from Riot API) ---
    riotProfile: {
      puuid: { type: String, default: null },
      gameName: { type: String, default: null },
      tagLine: { type: String, default: null },
      currentRank: { type: String, default: null },
      currentRankTier: { type: Number, default: null },
      rr: { type: Number, default: null },             // Ranked Rating
      peakRank: { type: String, default: null },
      topAgents: [{
        agent: String,
        matchesPlayed: Number,
        winRate: Number,
      }],
      lastUpdated: { type: Date, default: null },
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
          enum: ['left', 'removed', 'team disbanded', 'disbanded', 'transferred'],
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
    instagram: {
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

    // --- Shadow Profile Fields (admin-created pro player profiles) ---
    isShadowProfile: {
      type: Boolean,
      default: false,
      index: true,
    },
    shadowCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    // When admin claims/merges this shadow into a real account
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Shadow profiles auto-generate a sentinel email if none provided
playerSchema.pre('validate', function () {
  if (this.isNew && this.isShadowProfile && !this.email) {
    this.email = `shadow_${this._id}@aegis.internal`;
  }
  // Shadow profiles don't need a username — auto-generate if missing
  if (this.isNew && this.isShadowProfile && !this.username) {
    const ign = this.gameIds?.[0]?.inGameName || this.realName || this._id.toString().slice(-8);
    this.username = `pro_${ign.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}`;
  }
});

const Player = mongoose.model('Player', playerSchema);

// --- Performance Indexes ---
// Leaderboard sorting (GET /api/players/leaderboard/aegis)
playerSchema.index({ aegisRating: -1 });
// Team lookups (used in team member queries, team stats)
playerSchema.index({ team: 1 });
// Recruitment search pattern
playerSchema.index({ profileVisibility: 1, primaryGame: 1, aegisRating: -1 });
// Shadow profile lookups
playerSchema.index({ isShadowProfile: 1, claimedBy: 1 });
// Character ID lookup (for claim matching)
playerSchema.index({ 'gameIds.characterId': 1 });

export default Player;