import mongoose from 'mongoose';
import slugify from 'slugify';

/**
 * REFACTORED Tournament Schema
 * 
 * CHANGES FROM ORIGINAL:
 * - REMOVED: participatingTeams[] array (moved to Registration collection)
 * - REMOVED: phases[].groups[].standings[] nested arrays (moved to Standing collection)
 * - REMOVED: _pendingInvitations[] array (moved to Invitation collection)
 * - ADDED: participatingTeamsCount for quick access
 * - ADDED: Virtual relationships to Registration, Standing, Invitation
 * - OPTIMIZED: Smaller document size, better scalability for 1000+ teams
 */
const tournamentSchema = new mongoose.Schema(
  {
    // --- Basic Tournament Information ---
    tournamentName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      maxlength: 150,
    },
    shortName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    gameTitle: {
      type: String,
      enum: ['BGMI', 'Multi-Game'],
      default: 'BGMI',
      required: true,
      index: true,
    },

    // --- Tournament Classification ---
    tier: {
      type: String,
      enum: ['S', 'A', 'B', 'C', 'Community'],
      default: 'Community',
      index: true,
    },
    region: {
      type: String,
      enum: [
        'Global',
        'Asia',
        'India',
        'South Asia',
        'Europe',
        'North America',
        'South America',
        'Oceania',
        'Middle East',
        'Africa',
      ],
      default: 'India',
      index: true,
    },
    subRegion: {
      type: String,
      trim: true,
    },

    // --- Organizer Information ---
    organizer: {
      name: {
        type: String,
        required: true,
        trim: true,
        default: 'Aegis Esports',
      },
      website: String,
      contactEmail: String,
      organizationRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
      },
    },
    sponsors: [
      {
        name: String,
        logoUrl: String,
        website: String,
        tier: {
          type: String,
          enum: ['Title', 'Presenting', 'Official', 'Supporting'],
        },
      },
    ],

    // --- Tournament Timeline ---
    announcementDate: Date,
    isOpenForAll: {
      type: Boolean,
      default: false,
    },
    registrationStartDate: Date,
    registrationEndDate: Date,
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'announced',
        'registration_open',
        'registration_closed',
        'in_progress',
        'completed',
        'cancelled',
        'postponed',
      ],
      default: 'announced',
      index: true,
    },

    // --- Tournament Structure & Participation ---
    format: {
      type: String,
      enum: ['Battle Royale Points System', 'Elimination Format', 'Custom'],
      required: true,
    },
    formatDetails: {
      type: String,
      trim: true,
    },
    slots: {
      total: {
        type: Number,
        required: true,
        min: 2,
      },
      invited: {
        type: Number,
        default: 0,
      },
      openRegistrations: {
        type: Number,
        default: 0,
      },
      registered: {
        // Total registered (pending + approved)
        type: Number,
        default: 0,
        index: true,
      },
    },

    // --- REPLACED: participatingTeams array with counter ---
    // Use Registration collection for actual team data
    participatingTeamsCount: {
      type: Number,
      default: 0,
      index: true,
    },

    // --- Tournament Phases (SIMPLIFIED - no nested standings) ---
    phases: [
      {
        name: String,
        type: {
          type: String,
          enum: ['qualifiers', 'final_stage'],
          required: true,
        },
        startDate: Date,
        endDate: Date,
        status: {
          type: String,
          enum: ['upcoming', 'in_progress', 'completed'],
          default: 'upcoming',
        },
        matches: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Match',
          },
        ],
        rulesetSpecifics: String,
        details: String,

        // --- SIMPLIFIED: Just list teams, standings in separate collection ---
        teams: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
          },
        ],

        // --- Groups metadata (no standings stored here) ---
        groups: [
          {
            name: String,
            teams: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team',
              },
            ],
            // Standings moved to Standing collection
          },
        ],

        // --- Qualification Rules ---
        qualificationRules: [
          {
            numberOfTeams: { type: Number },
            source: { type: String, enum: ['overall', 'from_each_group'] },
            nextPhase: { type: String },
          },
        ],
      },
    ],

    // --- Overall Tournament Results ---
    finalStandings: [
      {
        position: {
          type: Number,
          required: true,
        },
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
          required: true,
        },
        prize: {
          amount: Number,
          currency: {
            type: String,
            default: 'INR',
          },
        },
        tournamentPointsAwarded: Number,
        qualification: String,
      },
    ],

    // --- Prize Information ---
    prizePool: {
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        enum: ['INR', 'USD'],
        default: 'INR',
      },
      distribution: [
        {
          position: String,
          amount: Number,
        },
      ],
      individualAwards: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          description: {
            type: String,
            trim: true,
          },
          amount: {
            type: Number,
            min: 0,
          },
          recipient: {
            player: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Player',
            },
            team: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Team',
            },
          },
          awarded: {
            type: Boolean,
            default: false,
          },
          awardedDate: Date,
        },
      ],
    },

    // --- Tournament Statistics ---
    statistics: {
      totalMatches: { type: Number, default: 0 },
      totalParticipatingTeams: { type: Number, default: 0 },
      totalKills: { type: Number, default: 0 },
      mostKillsInMatch: {
        count: Number,
        player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
      },
      mostChickenDinners: {
        count: Number,
        team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      },
      viewership: {
        currentViewers: { type: Number, default: 0 },
        peakViewers: { type: Number, default: 0 },
        averageViewers: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        totalHoursWatched: { type: Number, default: 0 },
      },
    },

    // --- Awards and Recognition ---
    awards: [
      {
        type: {
          type: String,
          enum: ['MVP', 'Best Player', 'Most Kills', 'Fan Favorite', 'Aegis Star'],
        },
        recipient: {
          player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
          team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        },
        description: String,
      },
    ],

    // --- Media and Coverage ---
    media: {
      logo: String,
      banner: String,
      coverImage: String,
      trailer: String,
      gallery: [String],
    },
    streamLinks: [
      {
        platform: {
          type: String,
          enum: [
            'YouTube',
            'Twitch',
            'Facebook Gaming',
            'Loco',
            'Rooter',
            'JioGames',
            'Custom',
          ],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        language: {
          type: String,
          default: 'English',
        },
        isOfficial: {
          type: Boolean,
          default: false,
        },
      },
    ],
    socialMedia: {
      twitter: String,
      instagram: String,
      discord: String,
      facebook: String,
      youtube: String,
    },

    // --- Documentation and Rules ---
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    rulesetDocument: String,
    websiteLink: String,

    // --- Game Specific Settings (BGMI) ---
    gameSettings: {
      serverRegion: String,
      gameMode: {
        type: String,
        enum: ['TPP Squad', 'FPP Squad', 'Custom'],
        default: 'TPP Squad',
      },
      maps: {
        type: [String],
        enum: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'],
        default: ['Erangel', 'Miramar'],
      },
      pointsSystem: mongoose.Schema.Types.Mixed,
    },

    // --- Administrative ---
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --- Qualification and Series Information ---
    parentSeries: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentSeries',
    },
    qualifiesFor: [
      {
        tournament: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tournament',
        },
        slots: Number,
        details: String,
      },
    ],

    // --- Metadata ---
    tags: [String],
    notes: String,
    externalIds: {
      liquipedia: String,
    },

    // --- Organization Tournament Approval System ---
    _approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not_applicable'],
      default: 'not_applicable',
      index: true,
    },
    _submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    _submittedAt: Date,
    _approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    _approvedAt: Date,
    _rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    _rejectedAt: Date,
    _rejectionReason: String,

    // REMOVED: _pendingInvitations[] (moved to Invitation collection)
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes for better query performance ---
tournamentSchema.index({ gameTitle: 1, region: 1, startDate: -1 });
tournamentSchema.index({ status: 1, startDate: -1 });
tournamentSchema.index({ featured: 1, startDate: -1 });
tournamentSchema.index({ 'prizePool.total': -1 });
tournamentSchema.index({ tags: 1 });
tournamentSchema.index({ 'organizer.name': 1 });

// --- Virtuals (derived properties) ---

// Virtual for tournament duration in days
tournamentSchema.virtual('durationDays').get(function () {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate.getTime() - this.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for registration status
tournamentSchema.virtual('registrationDisplayStatus').get(function () {
  const now = new Date();
  if (!this.status) return 'Unknown';
  if (this.status === 'cancelled') return 'Cancelled';
  if (this.status === 'completed') return 'Completed';
  if (this.status === 'in_progress') return 'Live';

  if (!this.registrationStartDate || !this.registrationEndDate) return 'Closed';
  if (now < this.registrationStartDate) return 'Upcoming';
  if (now >= this.registrationStartDate && now <= this.registrationEndDate) {
    // Check if slots are full
    if (this.participatingTeamsCount >= this.slots.total) {
      return 'Slots Full';
    }
    return 'Open';
  }
  if (now > this.registrationEndDate) return 'Closed';
  return 'Unknown';
});

// Virtual for current competition phase
tournamentSchema.virtual('currentCompetitionPhase').get(function () {
  if (!this.phases || this.phases.length === 0) return null;
  const now = new Date();
  const current = this.phases.find(
    (phase) => phase.startDate <= now && phase.endDate >= now
  );
  if (current) return current.name;
  const next = this.phases.find((phase) => phase.startDate > now);
  if (next) return `Next: ${next.name}`;
  const lastCompleted = this.phases.find((phase) => phase.status === 'completed');
  if (lastCompleted) return `Last: ${lastCompleted.name}`;
  return null;
});

// --- NEW: Virtual relationships to other collections ---

// Virtual to get all registrations (replaces participatingTeams array)
tournamentSchema.virtual('registrations', {
  ref: 'Registration',
  localField: '_id',
  foreignField: 'tournament',
});

// Virtual to get active teams
tournamentSchema.virtual('activeTeams', {
  ref: 'Registration',
  localField: '_id',
  foreignField: 'tournament',
  match: { status: { $in: ['approved', 'checked_in'] } },
});

// Virtual to get pending invitations
tournamentSchema.virtual('pendingInvitations', {
  ref: 'Invitation',
  localField: '_id',
  foreignField: 'tournament',
  match: { status: 'pending' },
});

// Virtual to get all invitations
tournamentSchema.virtual('invitations', {
  ref: 'Invitation',
  localField: '_id',
  foreignField: 'tournament',
});

// --- Pre-save middleware ---
tournamentSchema.pre('save', function () {
  // Generate slug from tournament name
  if (this.isModified('tournamentName') && this.tournamentName) {
    this.slug = slugify(this.tournamentName, { lower: true, strict: true });
  }
  // Note: participatingTeamsCount is now updated by Registration model
});

// --- Instance Methods ---

// Check if tournament is currently live
tournamentSchema.methods.isLive = function () {
  const now = new Date();
  return (
    this.startDate <= now &&
    this.endDate >= now &&
    ['in_progress', 'qualifiers_in_progress', 'group_stage', 'playoffs', 'finals'].includes(
      this.status
    )
  );
};

// Get a specific phase by name
tournamentSchema.methods.getPhase = function (phaseName) {
  return this.phases.find((phase) => phase.name === phaseName);
};

// Get leaderboard (delegates to Standing collection)
tournamentSchema.methods.getLeaderboard = async function (phase, group = null, limit = 20) {
  const Standing = mongoose.model('Standing');
  return Standing.getLeaderboard(this._id, phase, group, limit);
};

// Get team's registration
tournamentSchema.methods.getTeamRegistration = async function (teamId) {
  const Registration = mongoose.model('Registration');
  return Registration.findOne({
    tournament: this._id,
    team: teamId,
  });
};

// Check if team is registered
tournamentSchema.methods.isTeamRegistered = async function (teamId) {
  const Registration = mongoose.model('Registration');
  const registration = await Registration.findOne({
    tournament: this._id,
    team: teamId,
    status: { $in: ['pending', 'approved', 'checked_in'] },
  });
  return !!registration;
};

// Get registration statistics
tournamentSchema.methods.getRegistrationStats = async function () {
  const Registration = mongoose.model('Registration');
  const stats = await Registration.countByStatus(this._id);

  const result = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    checkedIn: 0,
  };

  stats.forEach((stat) => {
    result.total += stat.count;
    if (stat._id) {
      result[stat._id] = stat.count;
    }
  });

  return result;
};

// Invite team
tournamentSchema.methods.inviteTeam = async function (teamId, invitedBy, options = {}) {
  const Invitation = mongoose.model('Invitation');

  // Check if already invited
  const hasInvitation = await Invitation.hasActiveInvitation(this._id, teamId);
  if (hasInvitation) {
    throw new Error('Team already has a pending invitation');
  }

  return Invitation.create({
    tournament: this._id,
    team: teamId,
    invitedBy,
    phase: options.phase,
    group: options.group,
    message: options.message,
    expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
};

// Get phase standing summary
tournamentSchema.methods.getPhaseStanding = async function (phase) {
  const PhaseStanding = mongoose.model('PhaseStanding');
  return PhaseStanding.getCurrent(this._id, phase);
};

// --- Static Methods ---

// Find tournaments by game and region
tournamentSchema.statics.findByGameAndRegion = function (
  gameTitle,
  region,
  limit = 10
) {
  return this.find({
    gameTitle,
    region,
    visibility: 'public',
  })
    .sort({ startDate: -1 })
    .limit(limit);
};

// Find upcoming tournaments
tournamentSchema.statics.findUpcoming = function (limit = 10) {
  const now = new Date();
  return this.find({
    startDate: { $gte: now },
    visibility: 'public',
  })
    .sort({ startDate: 1 })
    .limit(limit);
};

// Find live tournaments
tournamentSchema.statics.findLive = function (limit = 10) {
  const now = new Date();
  return this.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
    status: {
      $in: ['qualifiers_in_progress', 'in_progress', 'group_stage', 'playoffs', 'finals'],
    },
    visibility: 'public',
  })
    .sort({ startDate: 1 })
    .limit(limit);
};

// Get tournament with full details (including registrations and standings)
tournamentSchema.statics.getFullDetails = async function (tournamentId) {
  const tournament = await this.findById(tournamentId)
    .populate('activeTeams')
    .populate('pendingInvitations');

  if (!tournament) return null;

  // Get registration stats
  tournament.registrationStats = await tournament.getRegistrationStats();

  return tournament;
};

const Tournament = mongoose.model('Tournament', tournamentSchema);

export default Tournament;