import mongoose from 'mongoose';

/**
 * Registration Schema
 * Tracks team participation in tournaments
 * Replaces the participatingTeams array in Tournament schema
 */
const registrationSchema = new mongoose.Schema(
  {
    // --- Core References ---
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },

    // --- Registration Details ---
    status: {
      type: String,
      enum: [
        'pending',           // Awaiting approval
        'approved',          // Approved to participate
        'rejected',          // Registration rejected
        'checked_in',        // Team has checked in for event
        'disqualified',      // Disqualified during tournament
        'withdrawn',         // Team withdrew
      ],
      default: 'pending',
      index: true,
    },

    // --- Qualification Information ---
    qualifiedThrough: {
      type: String,
      enum: ['invite', 'open_registration', 'qualifier', 'wildcard', 'direct_seed'],
      index: true,
    },

    // --- Tournament Progress ---
    currentStage: {
      type: String,
      trim: true,
      index: true,
    },
    phase: {
      type: String,
      trim: true,
      index: true,
    },
    group: {
      type: String,
      trim: true,
      index: true,
    },

    // --- Performance Stats (Aggregate across all matches) ---
    totalTournamentPoints: {
      type: Number,
      default: 0,
      index: true,
    },
    totalTournamentKills: {
      type: Number,
      default: 0,
    },
    totalChickenDinners: {
      type: Number,
      default: 0,
    },
    matchesPlayed: {
      type: Number,
      default: 0,
    },

    // --- Final Placement ---
    finalPosition: {
      type: Number,
      index: true,
    },
    prizeWon: {
      amount: Number,
      currency: {
        type: String,
        default: 'INR',
      },
    },

    // --- Registration Timestamps ---
    registeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    rejectedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    rejectionReason: String,
    checkedInAt: Date,
    withdrawnAt: Date,
    withdrawalReason: String,

    // --- Additional Metadata ---
    roster: [
      {
        player: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Player',
        },
        role: {
          type: String,
          enum: ['IGL', 'Fragger', 'Support', 'Sniper', 'Substitute'],
        },
        inGameName: String,
      },
    ],

    seedNumber: Number, // Seeding for brackets/groups

    notes: String, // Admin notes

    // --- Payment/Entry Fee (if applicable) ---
    entryFee: {
      amount: Number,
      currency: {
        type: String,
        default: 'INR',
      },
      paid: {
        type: Boolean,
        default: false,
      },
      paidAt: Date,
      transactionId: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Compound Indexes ---
// Ensure one registration per team per tournament
registrationSchema.index({ tournament: 1, team: 1 }, { unique: true });

// Common query patterns
registrationSchema.index({ tournament: 1, status: 1, totalTournamentPoints: -1 }); // Leaderboard by status
registrationSchema.index({ tournament: 1, phase: 1, group: 1 }); // Phase/group queries
registrationSchema.index({ team: 1, status: 1 }); // Team's active registrations
registrationSchema.index({ tournament: 1, qualifiedThrough: 1 }); // Filter by qualification method

// --- Virtuals ---

// Check if registration is active
registrationSchema.virtual('isActive').get(function () {
  return ['approved', 'checked_in'].includes(this.status);
});

// Average points per match
registrationSchema.virtual('averagePointsPerMatch').get(function () {
  if (this.matchesPlayed === 0) return 0;
  return (this.totalTournamentPoints / this.matchesPlayed).toFixed(2);
});

// --- Instance Methods ---

// Approve registration
registrationSchema.methods.approve = async function (adminId) {
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = adminId;
  return this.save();
};

// Reject registration
registrationSchema.methods.reject = async function (adminId, reason) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  this.rejectedBy = adminId;
  this.rejectionReason = reason;
  return this.save();
};

// Check-in team
registrationSchema.methods.checkIn = async function () {
  this.status = 'checked_in';
  this.checkedInAt = new Date();
  return this.save();
};

// Withdraw team
registrationSchema.methods.withdraw = async function (reason) {
  this.status = 'withdrawn';
  this.withdrawnAt = new Date();
  this.withdrawalReason = reason;
  return this.save();
};

// Update stats after a match
registrationSchema.methods.updateStats = async function (points, kills, chickenDinner = false) {
  this.totalTournamentPoints += points;
  this.totalTournamentKills += kills;
  if (chickenDinner) this.totalChickenDinners += 1;
  this.matchesPlayed += 1;
  return this.save();
};

// --- Static Methods ---

// Get all active registrations for a tournament
registrationSchema.statics.findActiveByTournament = function (tournamentId) {
  return this.find({
    tournament: tournamentId,
    status: { $in: ['approved', 'checked_in'] },
  }).populate('team', 'teamName logo');
};

// Get pending registrations for approval
registrationSchema.statics.findPendingByTournament = function (tournamentId) {
  return this.find({
    tournament: tournamentId,
    status: 'pending',
  })
    .populate('team', 'teamName logo')
    .sort({ registeredAt: 1 });
};

// Get tournament leaderboard (basic - for detailed use Standing model)
registrationSchema.statics.getLeaderboard = function (tournamentId, limit = 20) {
  return this.find({
    tournament: tournamentId,
    status: { $in: ['approved', 'checked_in'] },
  })
    .sort({ totalTournamentPoints: -1, totalTournamentKills: -1 })
    .limit(limit)
    .populate('team', 'teamName logo');
};

// Count registrations by status
registrationSchema.statics.countByStatus = function (tournamentId) {
  return this.aggregate([
    { $match: { tournament: mongoose.Types.ObjectId(tournamentId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
};

// Get team's tournaments
registrationSchema.statics.findByTeam = function (teamId, options = {}) {
  const query = { team: teamId };
  if (options.status) query.status = options.status;

  return this.find(query)
    .populate('tournament', 'tournamentName startDate endDate status')
    .sort({ registeredAt: -1 });
};

// Bulk approve registrations
registrationSchema.statics.bulkApprove = async function (registrationIds, adminId) {
  return this.updateMany(
    { _id: { $in: registrationIds }, status: 'pending' },
    {
      $set: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: adminId,
      },
    }
  );
};

// --- Pre-save Middleware ---
registrationSchema.pre('save', async function () {
  // Automatically set phase/group from currentStage if not set
  if (this.currentStage && !this.phase) {
    // You can parse currentStage like "Group A - Qualifiers" 
    // This is optional based on your naming convention
  }
});

// --- Post-save Middleware ---
// Update tournament's participatingTeamsCount
registrationSchema.post('save', async function (doc) {
  if (this.wasNew) {
    // Increment count when new registration is created
    await mongoose.model('Tournament').updateOne(
      { _id: doc.tournament },
      { $inc: { 'slots.registered': 1 } }
    );
  }

  // Update count of approved teams
  if (this.isModified('status')) {
    const count = await mongoose.model('Registration').countDocuments({
      tournament: doc.tournament,
      status: { $in: ['approved', 'checked_in'] },
    });

    await mongoose.model('Tournament').updateOne(
      { _id: doc.tournament },
      { $set: { participatingTeamsCount: count } }
    );
  }
});

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;