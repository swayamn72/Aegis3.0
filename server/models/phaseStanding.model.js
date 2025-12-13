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
        chickenDinners: Number,
        matchesPlayed: Number,
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
phaseStandingSchema.index({ lastCalculated: 1 }); // For finding stale data

// --- Virtuals ---

// Check if data is stale (older than 5 minutes)
phaseStandingSchema.virtual('isStale').get(function () {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastCalculated < fiveMinutesAgo;
});

// --- Instance Methods ---

// Recalculate phase standings from Standing collection
phaseStandingSchema.methods.recalculate = async function () {
  const Standing = mongoose.model('Standing');

  // Get all standings for this phase
  const standings = await Standing.find({
    tournament: this.tournament,
    phase: this.phase,
  })
    .populate('team', 'teamName logo')
    .sort({ points: -1, kills: -1 });

  if (standings.length === 0) {
    return this;
  }

  // Calculate statistics
  const totalTeams = standings.length;
  const totalPoints = standings.reduce((sum, s) => sum + s.points, 0);
  const totalKills = standings.reduce((sum, s) => sum + s.kills, 0);
  const totalChickenDinners = standings.reduce((sum, s) => sum + s.chickenDinners, 0);
  const totalMatches = standings.reduce((sum, s) => sum + s.matchesPlayed, 0);

  // Update statistics
  this.statistics = {
    totalTeams,
    totalMatches,
    totalPoints,
    totalKills,
    totalChickenDinners,
    averagePointsPerTeam: totalTeams > 0 ? totalPoints / totalTeams : 0,
    averageKillsPerTeam: totalTeams > 0 ? totalKills / totalTeams : 0,
  };

  // Update top teams (top 20)
  this.topTeams = standings.slice(0, 20).map((s, index) => ({
    position: index + 1,
    team: s.team._id,
    points: s.points,
    kills: s.kills,
    chickenDinners: s.chickenDinners,
    matchesPlayed: s.matchesPlayed,
  }));

  // Update leaders
  const sortedByKills = [...standings].sort((a, b) => b.kills - a.kills);
  const sortedByWins = [...standings].sort((a, b) => b.chickenDinners - a.chickenDinners);
  const sortedByAvgPos = [...standings].sort((a, b) => a.averagePosition - b.averagePosition);

  this.leaders = {
    mostPoints: {
      team: standings[0]?.team._id,
      value: standings[0]?.points || 0,
    },
    mostKills: {
      team: sortedByKills[0]?.team._id,
      value: sortedByKills[0]?.kills || 0,
    },
    mostChickenDinners: {
      team: sortedByWins[0]?.team._id,
      value: sortedByWins[0]?.chickenDinners || 0,
    },
    bestAveragePosition: {
      team: sortedByAvgPos[0]?.team._id,
      value: sortedByAvgPos[0]?.averagePosition || 0,
    },
  };

  // Update group summaries if groups exist
  const groups = [...new Set(standings.map((s) => s.group).filter(Boolean))];
  this.groupSummaries = await Promise.all(
    groups.map(async (groupName) => {
      const groupStandings = standings.filter((s) => s.group === groupName);
      const groupLeader = groupStandings[0];

      return {
        groupName,
        teamsCount: groupStandings.length,
        matchesPlayed: groupStandings.reduce((sum, s) => sum + s.matchesPlayed, 0),
        leader: {
          team: groupLeader?.team._id,
          points: groupLeader?.points || 0,
        },
      };
    })
  );

  // Update qualification info
  const qualifiedTeams = standings.filter((s) => s.isQualified).map((s) => s.team._id);
  const eliminatedTeams = standings.filter((s) => s.isEliminated).map((s) => s.team._id);

  this.qualification.qualifiedTeams = qualifiedTeams;
  this.qualification.eliminatedTeams = eliminatedTeams;

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
phaseStandingSchema.pre('save', function (next) {
  // Calculate trends if previous data exists
  if (this.isModified('statistics') && !this.isNew) {
    // Trends calculation would require storing previous values
    // This is simplified - you might want to implement proper trend tracking
  }
  next();
});

const PhaseStanding = mongoose.model('PhaseStanding', phaseStandingSchema);

export default PhaseStanding;