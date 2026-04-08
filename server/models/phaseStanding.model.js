import mongoose from 'mongoose';

/**
 * PhaseStanding Schema
 * Aggregated standings for entire phases (combining all groups)
 * Used for quick summary queries and overall phase leaderboards
 * This is a materialized view that gets updated periodically
 */
const phaseStandingSchema = new mongoose.Schema(
  {
    // --- Core References ---
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    phase: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // --- Phase Status ---
    status: {
      type: String,
      enum: ['upcoming', 'in_progress', 'completed'],
      default: 'upcoming',
      index: true,
    },

    // --- Overall Phase Statistics ---
    statistics: {
      totalTeams: {
        type: Number,
        default: 0,
      },
      totalMatches: {
        type: Number,
        default: 0,
      },
      totalPoints: {
        type: Number,
        default: 0,
      },
      totalKills: {
        type: Number,
        default: 0,
      },
      totalChickenDinners: {
        type: Number,
        default: 0,
      },
      averagePointsPerTeam: {
        type: Number,
        default: 0,
      },
      averageKillsPerTeam: {
        type: Number,
        default: 0,
      },
    },

    // --- Top Performers (Cached for quick access) ---
    topTeams: [
      {
        position: Number,
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        points: Number,
        kills: Number,
        positionPoints: Number,
        killPoints: Number,
        chickenDinners: Number,
        matchesPlayed: Number,
        group: String,
      },
    ],

    // --- Performance Leaders ---
    leaders: {
      mostPoints: {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        value: Number,
      },
      mostKills: {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        value: Number,
      },
      mostChickenDinners: {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        value: Number,
      },
      bestAveragePosition: {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        value: Number,
      },
    },

    // --- Group Breakdown (if applicable) ---
    groupSummaries: [
      {
        groupName: String,
        teamsCount: Number,
        matchesPlayed: Number,
        leader: {
          team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
          },
          points: Number,
        },
      },
    ],

    // --- Qualification Summary ---
    qualification: {
      slotsAvailable: Number,
      qualifiedTeams: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
      ],
      eliminatedTeams: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
      ],
      qualifiesTo: String, // Next phase name
    },

    // --- Timeline ---
    phaseStartDate: Date,
    phaseEndDate: Date,
    lastMatchDate: Date,

    // --- Update Tracking ---
    lastCalculated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    calculatedBy: {
      type: String,
      enum: ['auto', 'manual', 'cron'],
      default: 'auto',
    },

    // --- Trends (Comparison with previous calculation) ---
    trends: {
      pointsGrowth: Number, // % change since last calculation
      killsGrowth: Number,
      matchesAdded: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Compound Indexes ---
phaseStandingSchema.index({ tournament: 1, phase: 1 }, { unique: true });
phaseStandingSchema.index({ tournament: 1, status: 1 });

// --- Virtuals ---

// Check if data is stale (older than 5 minutes)
phaseStandingSchema.virtual('isStale').get(function () {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastCalculated < fiveMinutesAgo;
});

// --- Instance Methods ---

// Recalculate phase standings from Standing collection
phaseStandingSchema.methods.recalculate = async function () {
  const Match = mongoose.model('Match');

  // Aggregate results from ALL matches in this phase
  const stats = await Match.aggregate([
    {
      $match: {
        tournament: this.tournament,
        tournamentPhase: this.phase,
        status: 'completed'
      }
    },
    { $unwind: '$results' },
    {
      $group: {
        _id: '$results.team',
        matchesPlayed: { $sum: 1 },
        chickenDinners: { $sum: { $cond: ['$results.chickenDinner', 1, 0] } },
        killPoints: { $sum: { $ifNull: ['$results.points.killPoints', 0] } },
        placementPoints: { $sum: { $ifNull: ['$results.points.placementPoints', 0] } },
        totalPoints: { $sum: { $ifNull: ['$results.points.totalPoints', 0] } },
        totalKills: { $sum: { $ifNull: ['$results.kills.total', 0] } },
        // Track unique groups this team played in during this phase
        groups: { $addToSet: { $arrayElemAt: ['$participatingGroups', 0] } }
      }
    },
    {
      $lookup: {
        from: 'teams',
        localField: '_id',
        foreignField: '_id',
        as: 'teamInfo'
      }
    },
    { $unwind: '$teamInfo' },
    {
      // Final Sorting: total points > chicken > position > kill points > name
      $sort: {
        totalPoints: -1,
        chickenDinners: -1,
        placementPoints: -1,
        killPoints: -1,
        'teamInfo.teamName': 1
      }
    }
  ]);

  if (stats.length === 0) {
    return this;
  }

  // Update statistics summary
  const totalTeams = stats.length;
  const totalPoints = stats.reduce((sum, s) => sum + s.totalPoints, 0);
  const totalKills = stats.reduce((sum, s) => sum + s.totalKills, 0);
  const totalWins = stats.reduce((sum, s) => sum + s.chickenDinners, 0);
  const totalMatchesCount = await Match.countDocuments({
    tournament: this.tournament,
    tournamentPhase: this.phase,
    status: 'completed'
  });

  this.statistics = {
    totalTeams,
    totalMatches: totalMatchesCount,
    totalPoints,
    totalKills,
    totalChickenDinners: totalWins,
    averagePointsPerTeam: totalTeams > 0 ? totalPoints / totalTeams : 0,
    averageKillsPerTeam: totalTeams > 0 ? totalKills / totalTeams : 0,
  };

  // Update top teams (all of them for a full points table, or at least many)
  this.topTeams = stats.map((s, index) => ({
    position: index + 1,
    team: s._id,
    points: s.totalPoints,
    killPoints: s.killPoints,
    positionPoints: s.placementPoints,
    kills: s.totalKills,
    chickenDinners: s.chickenDinners,
    matchesPlayed: s.matchesPlayed,
    group: s.groups[0] || ''
  }));

  // Update leaders
  this.leaders = {
    mostPoints: {
      team: stats[0]?._id,
      value: stats[0]?.totalPoints || 0,
    },
    mostKills: {
      team: [...stats].sort((a, b) => b.totalKills - a.totalKills)[0]?._id,
      value: [...stats].sort((a, b) => b.totalKills - a.totalKills)[0]?.totalKills || 0,
    },
    mostChickenDinners: {
      team: [...stats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0]?._id,
      value: [...stats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0]?.chickenDinners || 0,
    }
  };

  this.lastCalculated = new Date();
  this.calculatedBy = 'auto';

  return this.save();
};

// Mark phase as completed
phaseStandingSchema.methods.complete = async function () {
  this.status = 'completed';
  return this.save();
};

// --- Static Methods ---

// Get or create phase standing
phaseStandingSchema.statics.getOrCreate = async function (tournamentId, phase) {
  let phaseStanding = await this.findOne({ tournament: tournamentId, phase });

  if (!phaseStanding) {
    phaseStanding = await this.create({
      tournament: tournamentId,
      phase,
      status: 'upcoming',
    });
  }

  return phaseStanding;
};

// Get current phase standing
phaseStandingSchema.statics.getCurrent = function (tournamentId, phase) {
  return this.findOne({ tournament: tournamentId, phase }).populate(
    'topTeams.team leaders.mostPoints.team leaders.mostKills.team'
  );
};

// Recalculate all phase standings for a tournament
phaseStandingSchema.statics.recalculateAll = async function (tournamentId) {
  const phaseStandings = await this.find({ tournament: tournamentId });

  for (const ps of phaseStandings) {
    await ps.recalculate();
  }

  return phaseStandings.length;
};

// Get stale phase standings (need recalculation)
phaseStandingSchema.statics.getStale = function (minutes = 5) {
  const threshold = new Date(Date.now() - minutes * 60 * 1000);
  return this.find({
    lastCalculated: { $lt: threshold },
    status: 'in_progress',
  });
};

// Get phase comparison (for multiple phases in same tournament)
phaseStandingSchema.statics.comparePhases = async function (tournamentId, phases) {
  const phaseStandings = await this.find({
    tournament: tournamentId,
    phase: { $in: phases },
  }).sort({ phaseStartDate: 1 });

  return phaseStandings.map((ps) => ({
    phase: ps.phase,
    status: ps.status,
    totalTeams: ps.statistics.totalTeams,
    averagePoints: ps.statistics.averagePointsPerTeam,
    leader: ps.leaders.mostPoints,
  }));
};

// Get tournament progress summary
phaseStandingSchema.statics.getTournamentProgress = async function (tournamentId) {
  const phases = await this.find({ tournament: tournamentId }).sort({
    phaseStartDate: 1,
  });

  const completed = phases.filter((p) => p.status === 'completed').length;
  const inProgress = phases.filter((p) => p.status === 'in_progress').length;
  const upcoming = phases.filter((p) => p.status === 'upcoming').length;

  return {
    total: phases.length,
    completed,
    inProgress,
    upcoming,
    currentPhase: phases.find((p) => p.status === 'in_progress')?.phase || null,
    phases: phases.map((p) => ({
      name: p.phase,
      status: p.status,
      teams: p.statistics.totalTeams,
      matches: p.statistics.totalMatches,
    })),
  };
};

// --- Pre-save Middleware ---
phaseStandingSchema.pre('save', function () {
  // Calculate trends if previous data exists
  if (this.isModified('statistics') && !this.isNew) {
    // Trends calculation would require storing previous values
    // This is simplified - you might want to implement proper trend tracking
  }
});

const PhaseStanding = mongoose.model('PhaseStanding', phaseStandingSchema);

export default PhaseStanding;