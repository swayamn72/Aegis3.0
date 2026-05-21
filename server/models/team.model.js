import mongoose from 'mongoose';
import { SUPPORTED_GAMES, GAME_REGISTRY } from '../config/gameRegistry.js';

const teamSchema = new mongoose.Schema(
  {
    teamId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      length: 6,
    },
    teamName: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 100,
    },
    teamTag: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 6,
    },
    logo: {
      type: String,
      trim: true,
      default: 'https://placehold.co/200x200/1a1a1a/ffffff?text=TEAM',
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
    primaryGame: {
      type: String,
      enum: SUPPORTED_GAMES,
      required: true,
      default: 'BGMI',
    },
    region: {
      type: String,
      enum: ['Global', 'India'],
      default: 'India',
    },
    country: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    establishedDate: {
      type: Date,
      default: Date.now,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    aegisRating: { // Team-level rating (computed as roster mean)
      type: Number,
      default: 0,
      min: 0,
    },

    // Tournament and match statistics
    statistics: {
      tournamentsPlayed: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
      totalKills: { type: Number, default: 0 },
      chickenDinners: { type: Number, default: 0 },
      averagePlacement: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
    },

    // Recent tournament results
    recentResults: [
      {
        tournament: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tournament',
        },
        placement: Number,
        points: Number,
        earnings: Number,
        date: Date,
      }
    ],

    // Valorant-specific team stats
    valorantStats: {
      tournamentsPlayed: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      totalKills: { type: Number, default: 0 },
      totalDeaths: { type: Number, default: 0 },
      totalAssists: { type: Number, default: 0 },
      roundsPlayed: { type: Number, default: 0 },
      roundsWon: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
    },

    // Valorant team rating
    valRating: {
      type: Number,
      default: 0,
      min: 0,
    },

    qualifiedEvents: [
      {
        tournament: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tournament',
        },
        eventName: String,
        qualificationDate: Date,
      },
    ],

    organization: { // If the team belongs to a larger organization
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },

    socials: {
      discord: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
      instagram: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },
      website: { type: String, trim: true, default: '' },
    },

    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    // Team status and availability
    status: {
      type: String,
      enum: ['active', 'inactive', 'disbanded', 'looking_for_players'],
      default: 'active',
    },

    // Recruitment information
    lookingForPlayers: {
      type: Boolean,
      default: false,
    },
    openRoles: [
      {
        type: String,
        enum: [
          // BGMI
          'IGL', 'Assaulter', 'Support', 'Sniper', 'Fragger',
          // Valorant
          'Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex',
          // Shared
          'Coach',
        ],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Enforce per-game max roster size from gameRegistry (BGMI=5, VALORANT=6)
teamSchema.pre('validate', function () {
  const max = GAME_REGISTRY[this.primaryGame]?.maxRosterSize ?? 5;
  if (Array.isArray(this.players) && this.players.length > max) {
    this.invalidate('players', `Team roster cannot exceed ${max} players for ${this.primaryGame}`);
  }
});

// Virtual for win rate calculation
teamSchema.virtual('winRatePercentage').get(function () {
  if (this.statistics.matchesPlayed === 0) return 0;
  return Math.round((this.statistics.matchesWon / this.statistics.matchesPlayed) * 100);
});

// Virtual for average kills per match
teamSchema.virtual('averageKillsPerMatch').get(function () {
  if (this.statistics.matchesPlayed === 0) return 0;
  return Math.round((this.statistics.totalKills / this.statistics.matchesPlayed) * 100) / 100;
});

// Indexes for better query performance
teamSchema.index({ teamName: 1, primaryGame: 1 });
teamSchema.index({ region: 1, primaryGame: 1 });
teamSchema.index({ 'statistics.tournamentsPlayed': -1 });
teamSchema.index({ totalEarnings: -1 });
teamSchema.index({ aegisRating: -1 });
teamSchema.index({ status: 1, lookingForPlayers: 1 });
teamSchema.index({ players: 1 });
teamSchema.index({ coach: 1 });
teamSchema.index({ valRating: -1 });


// Static method to find teams by game and region
teamSchema.statics.findByGameAndRegion = function (game, region, limit = 10) {
  return this.find({
    primaryGame: game,
    region: region,
    profileVisibility: 'public',
    status: 'active'
  })
    .populate('captain', 'username profilePicture')
    .populate('coach', 'username profilePicture')
    .populate('players', 'username profilePicture')
    .sort({ aegisRating: -1 })
    .limit(limit);
};

// Static method to find teams looking for players
teamSchema.statics.findLookingForPlayers = function (game, role, limit = 10) {
  const query = {
    lookingForPlayers: true,
    status: 'active',
    profileVisibility: 'public'
  };

  if (game) query.primaryGame = game;
  if (role) query.openRoles = role;

  return this.find(query)
    .populate('captain', 'username profilePicture')
    .populate('coach', 'username profilePicture')
    .populate('players', 'username profilePicture')
    .sort({ aegisRating: -1 })
    .limit(limit);
};

// Static method to generate unique 6-character alphanumeric teamId (all capitals)
teamSchema.statics.generateTeamId = async function () {
  let teamId;
  let isUnique = false;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  while (!isUnique) {
    // Generate random 6-character alphanumeric string
    teamId = '';
    for (let i = 0; i < 6; i++) {
      teamId += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if this teamId already exists
    const existingTeam = await this.findOne({ teamId });
    if (!existingTeam) {
      isUnique = true;
    }
  }

  return teamId;
};

const Team = mongoose.model('Team', teamSchema);

export default Team;