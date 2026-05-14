import mongoose from 'mongoose';
import { SUPPORTED_GAMES } from '../config/gameRegistry.js';

const matchSchema = new mongoose.Schema(
  {
    // --- Basic Match Information ---
    matchNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    // --- Tournament Reference ---
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    tournamentPhase: {
      type: String,
      trim: true,
      required: true, // e.g., "Group Stage Day 1", "Grand Finals"
    },

    // --- Match Timing ---
    scheduledStartTime: {
      type: Date,
      required: true,
      index: true,
    },

    // --- Match Status ---
    status: {
      type: String,
      enum: [
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'scheduled',
      index: true,
    },

    // --- Game Identification ---
    gameTitle: {
      type: String,
      enum: SUPPORTED_GAMES,
      required: true,
      default: 'BGMI',
      index: true,
    },

    // --- Map (validated at route level per game, no hardcoded enum) ---
    map: {
      type: String,
      required: true,
    },

    // Persist selected groups for scheduled/display
    participatingGroups: [{ type: String }],

    // --- Match Results per Team ---
    // Store results as array with team performance data
    results: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
          required: true,
        },
        finalPosition: {
          type: Number,
          min: 1,
          max: 25,
          default: null,
        },
        points: {
          placementPoints: { type: Number, default: 0 },
          killPoints: { type: Number, default: 0 },
          totalPoints: { type: Number, default: 0 },
        },
        kills: {
          total: { type: Number, default: 0 },
          unmatchedKills: { type: Number, default: 0 },
          breakdown: [
            {
              player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
              kills: { type: Number, default: 0 },
              isPlaying: { type: Boolean, default: true },
            }
          ]
        },
        chickenDinner: {
          type: Boolean,
          default: false,
        },
        // --- Live Scoring Fields ---
        isEliminated: {
          type: Boolean,
          default: false,
        },
        eliminationOrder: {
          type: Number,       // 1 = first team eliminated, 2 = second, etc.
          default: null,
        },
      }
    ],

    // --- Live Scoring State ---
    liveState: {
      isLiveScoring: { type: Boolean, default: false },
      teamsAlive: { type: Number, default: 0 },
      totalTeams: { type: Number, default: 0 },
      eliminationCount: { type: Number, default: 0 },  // How many teams eliminated so far
      lastUpdatedAt: { type: Date },
      lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    },

    // --- Match Statistics ---
    matchStats: {
      totalKills: { type: Number, default: 0 },
      mostKillsPlayer: {
        player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        kills: Number,
      },
    },

    // --- Streaming ---
    streamUrls: [
      {
        platform: {
          type: String,
          enum: ['YouTube', 'Instagram', 'Facebook Gaming', 'Loco', 'Rooter'],
        },
        url: String,
        language: String,
        isMain: Boolean,
      }
    ],

    // --- Room Credentials ---
    roomCredentials: {
      roomId: {
        type: String,
        trim: true,
      },
      password: {
        type: String,
        trim: true,
      },
      sharedAt: {
        type: Date,
      },
      sharedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
      },
    },

    // --- Metadata ---
    tags: [String], // For categorization

    // ══════════════════════════════════════════════════════════════════════════
    // Valorant 5v5 Results (used when gameTitle = 'VALORANT')
    // ══════════════════════════════════════════════════════════════════════════
    vsResults: {
      teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      scoreA: { type: Number, default: 0 },   // total rounds won by Team A
      scoreB: { type: Number, default: 0 },   // total rounds won by Team B
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
      // For Bo3/Bo5: per-map breakdown
      mapResults: [{
        map: String,
        scoreA: { type: Number, default: 0 },
        scoreB: { type: Number, default: 0 },
        winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        halfScores: {
          attackA: { type: Number, default: 0 },
          defenseA: { type: Number, default: 0 },
          attackB: { type: Number, default: 0 },
          defenseB: { type: Number, default: 0 },
        },
      }],
      // Individual player stats
      playerStats: [{
        player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        kills: { type: Number, default: 0 },
        deaths: { type: Number, default: 0 },
        assists: { type: Number, default: 0 },
        agent: { type: String },
        acs: { type: Number, default: 0 },         // Average Combat Score
        adr: { type: Number, default: 0 },         // Average Damage per Round
        firstKills: { type: Number, default: 0 },
        firstDeaths: { type: Number, default: 0 },
        clutches: { type: Number, default: 0 },
        plants: { type: Number, default: 0 },
        defuses: { type: Number, default: 0 },
        multiKills: { type: Number, default: 0 },  // 3k/4k/5k rounds
      }],
      totalRounds: { type: Number, default: 0 },
      isOvertime: { type: Boolean, default: false },
    },

    // --- Result Processing Metadata ---
    metadata: {
      ocrProcessed: { type: Boolean, default: false },
      ocrProcessedAt: { type: Date },
      manuallyEntered: { type: Boolean, default: false },
      bestOf: { type: Number, default: 1 },       // Bo1/Bo3/Bo5 for Valorant
      swissRound: { type: Number, default: null }, // Swiss round index
    },
    bracketRound: {
      type: Number,
      default: null,
      index: true, // queried by Swiss idempotency guard
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
      index: true,
    },
    matchType: {
      type: String,
      enum: ['scheduled', 'custom', 'auto'],
      default: 'scheduled',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes for better query performance ---
matchSchema.index({ tournament: 1, matchNumber: 1 });
matchSchema.index({ status: 1, scheduledStartTime: 1 });
matchSchema.index({ map: 1, status: 1 });
matchSchema.index({ matchType: 1, scheduledStartTime: -1 });
matchSchema.index({ 'results.team': 1 });
matchSchema.index({ createdAt: -1 });
matchSchema.index({ gameTitle: 1, status: 1 });
matchSchema.index({ 'vsResults.teamA': 1 });
matchSchema.index({ 'vsResults.teamB': 1 });

// --- Virtuals ---

// Virtual for winner team
matchSchema.virtual('winner').get(function () {
  return this.results?.find(team => team.finalPosition === 1);
});

// Virtual for chicken dinner team
matchSchema.virtual('chickenDinnerTeam').get(function () {
  return this.results?.find(team => team.chickenDinner === true);
});

// Virtual for teams count
matchSchema.virtual('teamsCount').get(function () {
  return this.results?.length || 0;
});

// Virtual to check if match is live
matchSchema.virtual('isLive').get(function () {
  return this.status === 'in_progress';
});

// --- Pre-save middleware ---
matchSchema.pre('save', function () {
  // Calculate total match stats from results (BR games)
  if (this.gameTitle === 'BGMI' || !this.gameTitle) {
    if (this.results && this.results.length > 0) {
      this.matchStats.totalKills = this.results.reduce((total, team) => total + team.kills.total, 0);
    }
  }
  // Calculate total kills from vsResults (Valorant)
  if (this.gameTitle === 'VALORANT' && this.vsResults?.playerStats?.length > 0) {
    this.matchStats.totalKills = this.vsResults.playerStats.reduce((total, p) => total + (p.kills || 0), 0);
  }
});

// --- Instance Methods ---

// Method to get team by position
matchSchema.methods.getTeamByPosition = function (position) {
  return this.results?.find(team => team.finalPosition === position);
};

// Method to get top N teams
matchSchema.methods.getTopTeams = function (n = 3) {
  return this.results
    ?.filter(team => team.finalPosition)
    .sort((a, b) => a.finalPosition - b.finalPosition)
    .slice(0, n) || [];
};

// Method to get match leaderboard
matchSchema.methods.getLeaderboard = function () {
  return this.results
    ?.map(team => ({
      team: team.team,
      position: team.finalPosition,
      kills: team.kills.total,
      totalPoints: team.points.totalPoints,
      chickenDinner: team.chickenDinner
    }))
    .sort((a, b) => a.position - b.position) || [];
};

// --- Static Methods ---

// Find matches by tournament
matchSchema.statics.findByTournament = function (tournamentId, limit = 20) {
  return this.find({ tournament: tournamentId })
    .sort({ scheduledStartTime: -1 })
    .limit(limit)
    .populate('results.team', 'teamName teamTag logo')
    .populate('tournament', 'tournamentName shortName');
};

// Find live matches
matchSchema.statics.findLive = function () {
  return this.find({
    status: 'in_progress',
    visibility: 'public'
  })
    .populate('results.team', 'teamName teamTag logo')
    .populate('tournament', 'tournamentName shortName')
    .sort({ scheduledStartTime: 1 });
};

// Find recent completed matches
matchSchema.statics.findRecentCompleted = function (limit = 10) {
  return this.find({
    status: 'completed',
    visibility: 'public'
  })
    .sort({ actualEndTime: -1 })
    .limit(limit)
    .populate('results.team', 'teamName teamTag logo')
    .populate('tournament', 'tournamentName shortName');
};

// Find matches by map
matchSchema.statics.findByMap = function (map, limit = 10) {
  return this.find({
    map: map,
    status: 'completed',
    visibility: 'public'
  })
    .sort({ actualEndTime: -1 })
    .limit(limit);
};

const Match = mongoose.model('Match', matchSchema);

export default Match;
