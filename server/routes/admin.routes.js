import express from 'express';
import Admin from '../models/admin.model.js';
import { generateAdminToken, verifyAdminToken } from '../middleware/adminAuth.js';
import rateLimit from 'express-rate-limit';
import Tournament from '../models/tournament.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import Organization from '../models/organization.model.js';
import UserReport from '../models/userReport.model.js';
import mongoose from 'mongoose';

const router = express.Router();

// Strict rate limiter for admin login endpoint
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests to prevent brute force
});

// Admin login
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });


    if (!admin) {
      console.warn(`Admin login failed: invalid email (${email})`);
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    if (admin.isLocked()) {
      return res.status(423).json({
        error: 'Account is temporarily locked. Please try again later.'
      });
    }


    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      await admin.incLoginAttempts();
      console.warn(`Admin login failed: invalid password for email (${email})`);
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // Successful login
    await admin.resetLoginAttempts();

    const token = generateAdminToken(admin._id);

    // Set cookie for compatibility with auth middleware
    res.cookie('token', token, {
      httpOnly: true, // Prevent client-side JS access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    res.json({
      message: 'Login successful',
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      error: 'Internal server error during login.'
    });
  }
});

// Verify admin authentication
router.get('/verify', verifyAdminToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.adminId).select('-password');

    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    res.json({
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Admin verify error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Logout admin
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully' });
});

// Get dashboard statistics
router.get('/dashboard/stats', verifyAdminToken, async (req, res) => {
  try {
    const now = new Date();

    // Tournament stats
    const [totalTournaments, activeTournaments, upcomingTournaments] = await Promise.all([
      Tournament.countDocuments(),
      Tournament.countDocuments({
        status: { $in: ['in_progress'] }
      }),
      Tournament.countDocuments({
        startDate: { $gte: now },
        status: { $in: ['announced', 'registration_open'] }
      })
    ]);

    // Match stats
    const [totalMatches, activeMatches, scheduledMatches] = await Promise.all([
      Match.countDocuments(),
      Match.countDocuments({ status: 'in_progress' }),
      Match.countDocuments({ status: 'scheduled', scheduledStartTime: { $gte: now } })
    ]);

    // Player stats (unique players in approved/checked_in teams for all tournaments)
    const uniquePlayersResult = await Registration.aggregate([
      { $match: { status: { $in: ['approved', 'checked_in'] } } },
      { $unwind: "$roster" },
      { $group: { _id: "$roster.player" } },
      { $count: "totalPlayers" }
    ]);
    const totalPlayers = uniquePlayersResult[0]?.totalPlayers || 0;

    // Compose stats
    const stats = {
      totalTournaments,
      activeMatches,
      totalPlayers,
      upcomingEvents: upcomingTournaments + scheduledMatches,
      trends: {
        tournaments: 0, // Placeholder for trend logic
        matches: 0,
        players: 0,
        events: 0
      }
    };
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activity (mock data for now)
router.get('/dashboard/activity', verifyAdminToken, async (req, res) => {
  try {
    const activities = [
      {
        type: 'success',
        message: 'New tournament "BGMI Championship" created',
        time: '2 hours ago'
      },
      {
        type: 'warning',
        message: 'Match #1245 requires admin review',
        time: '4 hours ago'
      },
      {
        type: 'success',
        message: 'Player verification completed for 15 players',
        time: '6 hours ago'
      },
      {
        type: 'info',
        message: 'Server maintenance scheduled for tonight',
        time: '1 day ago'
      }
    ];

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Get all matches (optimized)
router.get('/matches', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      tournament,
      map,
      phase,
      sortBy = 'scheduledStartTime',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * parseInt(limit);
    const query = {};

    // Build query filters
    if (status) {
      query.status = status;
    }

    if (tournament) {
      query.tournament = tournament;
    }

    if (map) {
      query.map = map;
    }

    if (phase) {
      query.tournamentPhase = { $regex: phase, $options: 'i' };
    }

    // Search across tournament name and match number
    if (search) {
      const tournaments = await Tournament.find({
        $or: [
          { tournamentName: { $regex: search, $options: 'i' } },
          { shortName: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();

      const tournamentIds = tournaments.map(t => t._id);

      // If search is a number, also search by match number
      const isNumber = !isNaN(search);
      query.$or = [
        { tournament: { $in: tournamentIds } }
      ];

      if (isNumber) {
        query.$or.push({ matchNumber: parseInt(search) });
      }
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with lean() for better performance
    const [matches, total] = await Promise.all([
      Match.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('tournament', 'tournamentName shortName gameTitle status slug')
        .populate('results.team', 'teamName teamTag logo aegisRating')
        .select('-results.kills.breakdown -roomCredentials.password') // Exclude sensitive data
        .lean(),
      Match.countDocuments(query)
    ]);

    // Enhance matches with computed data
    const enhancedMatches = matches.map(match => ({
      ...match,
      teamsCount: match.participatingTeams?.length || 0,
      isLive: match.status === 'in_progress',
      isUpcoming: match.status === 'scheduled' && new Date(match.scheduledStartTime) > new Date(),
      isPast: match.status === 'completed' || (match.status === 'scheduled' && new Date(match.scheduledStartTime) < new Date())
    }));

    res.json({
      matches: enhancedMatches,
      pagination: {
        current: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
        total,
        hasNext: skip + parseInt(limit) < total,
        hasPrev: page > 1
      },
      filters: {
        status,
        tournament,
        map,
        phase,
        search
      }
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches', message: error.message });
  }
});

// ==================== TOURNAMENT MANAGEMENT ROUTES ====================

// Rate limiter for tournament modification endpoints
const tournamentActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many tournament actions from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation helper
const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Sanitize string input to prevent XSS
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

// Get all tournaments with advanced filters and pagination (SECURE)
router.get('/tournaments', verifyAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      approvalStatus,
      status,
      tier,
      region,
      gameTitle,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    // Validate and sanitize pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // Max 100 items per page
    const skip = (pageNum - 1) * limitNum;

    // Build secure query
    const query = {};

    // Approval status filter (SECURITY: validate enum values)
    if (approvalStatus && ['pending', 'approved', 'rejected', 'not_applicable'].includes(approvalStatus)) {
      query._approvalStatus = approvalStatus;
    }

    // Tournament status filter (SECURITY: validate enum values)
    if (status && ['announced', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled', 'postponed'].includes(status)) {
      query.status = status;
    }

    // Tier filter (SECURITY: validate enum values)
    if (tier && ['S', 'A', 'B', 'C', 'Community'].includes(tier)) {
      query.tier = tier;
    }

    // Game title filter (SECURITY: validate enum values)
    if (gameTitle && ['BGMI', 'VALORANT'].includes(gameTitle)) {
      query.gameTitle = gameTitle;
    }

    // Region filter (SECURITY: validate enum values)
    const validRegions = ['Global', 'Asia', 'India', 'South Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Middle East', 'Africa'];
    if (region && validRegions.includes(region)) {
      query.region = region;
    }

    // Date range filter (SECURITY: validate dates)
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          query.startDate.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          query.startDate.$lte = end;
        }
      }
    }

    // Search filter (SECURITY: sanitize and use regex safely)
    if (search) {
      const sanitizedSearch = sanitizeString(search);
      if (sanitizedSearch) {
        query.$or = [
          { tournamentName: { $regex: sanitizedSearch, $options: 'i' } },
          { shortName: { $regex: sanitizedSearch, $options: 'i' } },
          { 'organizer.name': { $regex: sanitizedSearch, $options: 'i' } }
        ];
      }
    }

    // Validate sort field (SECURITY: whitelist allowed fields)
    const allowedSortFields = ['createdAt', 'startDate', 'endDate', 'tournamentName', 'tier', '_approvalStatus', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Execute query with lean() for performance
    const [tournaments, total, pendingCount, approvedCount] = await Promise.all([
      Tournament.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .populate('organizer.organizationRef', 'orgName orgLogo contactEmail status')
        .populate('_submittedBy', 'orgName orgLogo')
        .populate('_approvedBy', 'username email')
        .populate('_rejectedBy', 'username email')
        .select('-roomCredentials -notes') // Exclude sensitive data
        .lean(),
      Tournament.countDocuments(query),
      Tournament.countDocuments({ _approvalStatus: 'pending' }),
      Tournament.countDocuments({ _approvalStatus: 'approved' })
    ]);

    // Enhance tournaments with computed data
    const enhancedTournaments = tournaments.map(tournament => {
      // Get registration stats safely
      const totalSlots = tournament.slots?.total || 0;
      const filledSlots = tournament.slots?.filled || 0;
      const registeredCount = tournament.slots?.registered || 0;

      return {
        ...tournament,
        slotsInfo: {
          total: totalSlots,
          filled: filledSlots,
          registered: registeredCount,
          available: Math.max(0, totalSlots - filledSlots),
          fillPercentage: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0
        },
        prizePoolDisplay: (tournament.prizePool && (tournament.prizePool.total !== undefined && tournament.prizePool.total !== null))
          ? `${tournament.prizePool.currency || '₹'}${tournament.prizePool.total.toLocaleString()}`
          : 'TBD',
        prizePoolTotal: tournament.prizePool?.total || 0, // Sending raw total too for detail usage if needed
        prizePoolCurrency: tournament.prizePool?.currency || '₹',
        isPending: tournament._approvalStatus === 'pending',
        isApproved: tournament._approvalStatus === 'approved',
        isRejected: tournament._approvalStatus === 'rejected',
        isLive: tournament.status === 'in_progress',
        isUpcoming: new Date(tournament.startDate) > new Date() && tournament.status !== 'cancelled',
        isPast: tournament.status === 'completed'
      };
    });

    res.json({
      tournaments: enhancedTournaments,
      pagination: {
        current: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
        total,
        hasNext: skip + limitNum < total,
        hasPrev: pageNum > 1
      },
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        total
      },
      filters: {
        approvalStatus,
        status,
        tier,
        region,
        gameTitle,
        search,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// Get single tournament details (SECURE)
router.get('/tournaments/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;

    // SECURITY: Validate ObjectId
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    const tournament = await Tournament.findById(id)
      .populate('organizer.organizationRef', 'orgName orgLogo contactEmail contactPhone website status createdAt')
      .populate('_submittedBy', 'orgName orgLogo contactEmail')
      .populate('_approvedBy', 'username email')
      .populate('_rejectedBy', 'username email')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get registration statistics
    const registrationStats = await Registration.aggregate([
      { $match: { tournament: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      checked_in: 0
    };

    registrationStats.forEach(stat => {
      stats[stat._id] = stat.count;
    });

    res.json({
      tournament,
      registrationStats: stats
    });
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    res.status(500).json({ error: 'Failed to fetch tournament details' });
  }
});

// Approve tournament (SECURE)
router.patch('/tournaments/:id/approve', verifyAdminToken, tournamentActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.adminId;

    // SECURITY: Validate ObjectId
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    // SECURITY: Verify tournament exists and is in pending state
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament._approvalStatus === 'approved') {
      return res.status(400).json({ error: 'Tournament is already approved' });
    }

    // Update tournament with approval details
    tournament._approvalStatus = 'approved';
    tournament._approvedBy = adminId;
    tournament._approvedAt = new Date();
    tournament.visibility = 'public'; // Automatically make public upon approval
    // Clear rejection data if it was previously rejected
    tournament._rejectedBy = undefined;
    tournament._rejectedAt = undefined;
    tournament._rejectionReason = undefined;

    await tournament.save();

    // Send tournament approval email to organization
    try {
      const Organization = (await import('../models/organization.model.js')).default;
      const { sendTournamentApprovalEmail } = await import('../config/email.js');
      // Find org email and name
      let orgEmail = null;
      let orgName = null;
      if (tournament.organizer && tournament.organizer.organizationRef) {
        const org = await Organization.findById(tournament.organizer.organizationRef);
        if (org) {
          orgEmail = org.email;
          orgName = org.orgName;
        }
      }
      if (orgEmail && orgName) {
        await sendTournamentApprovalEmail(orgEmail, orgName, tournament.tournamentName);
        console.log(`Tournament approval email sent to ${orgEmail}`);
      } else {
        console.warn('Could not send tournament approval email: org info missing');
      }
    } catch (emailErr) {
      console.error('Error sending tournament approval email:', emailErr);
    }

    // Log the action for audit trail
    console.log(`Admin ${adminId} approved tournament ${id} at ${new Date().toISOString()}`);

    res.json({
      message: 'Tournament approved successfully',
      tournament: {
        id: tournament._id,
        tournamentName: tournament.tournamentName,
        _approvalStatus: tournament._approvalStatus,
        _approvedBy: tournament._approvedBy,
        _approvedAt: tournament._approvedAt
      }
    });
  } catch (error) {
    console.error('Error approving tournament:', error);
    res.status(500).json({ error: 'Failed to approve tournament' });
  }
});

// Reject tournament (SECURE)
router.patch('/tournaments/:id/reject', verifyAdminToken, tournamentActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.adminId;

    // SECURITY: Validate ObjectId
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    // SECURITY: Validate rejection reason
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const sanitizedReason = sanitizeString(reason);
    if (!sanitizedReason || sanitizedReason.length < 10) {
      return res.status(400).json({ error: 'Rejection reason must be at least 10 characters' });
    }

    if (sanitizedReason.length > 500) {
      return res.status(400).json({ error: 'Rejection reason must not exceed 500 characters' });
    }

    // SECURITY: Verify tournament exists
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament._approvalStatus === 'rejected') {
      return res.status(400).json({ error: 'Tournament is already rejected' });
    }

    // Update tournament with rejection details
    tournament._approvalStatus = 'rejected';
    tournament._rejectedBy = adminId;
    tournament._rejectedAt = new Date();
    tournament._rejectionReason = sanitizedReason;
    // Clear approval data if it was previously approved
    tournament._approvedBy = undefined;
    tournament._approvedAt = undefined;

    await tournament.save();

    // Log the action for audit trail
    console.log(`Admin ${adminId} rejected tournament ${id} at ${new Date().toISOString()}`);

    res.json({
      message: 'Tournament rejected successfully',
      tournament: {
        id: tournament._id,
        tournamentName: tournament.tournamentName,
        _approvalStatus: tournament._approvalStatus,
        _rejectedBy: tournament._rejectedBy,
        _rejectedAt: tournament._rejectedAt,
        _rejectionReason: tournament._rejectionReason
      }
    });
  } catch (error) {
    console.error('Error rejecting tournament:', error);
    res.status(500).json({ error: 'Failed to reject tournament' });
  }
});

// Update tournament status (SECURE)
router.patch('/tournaments/:id/status', verifyAdminToken, tournamentActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.admin.adminId;

    // SECURITY: Validate ObjectId
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    // SECURITY: Validate status enum
    const validStatuses = ['announced', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled', 'postponed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value',
        validStatuses
      });
    }

    // SECURITY: Verify tournament exists
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Update status
    const oldStatus = tournament.status;
    tournament.status = status;
    await tournament.save();

    // Log the action for audit trail
    console.log(`Admin ${adminId} changed tournament ${id} status from ${oldStatus} to ${status} at ${new Date().toISOString()}`);

    res.json({
      message: 'Tournament status updated successfully',
      tournament: {
        id: tournament._id,
        tournamentName: tournament.tournamentName,
        oldStatus,
        newStatus: status
      }
    });
  } catch (error) {
    console.error('Error updating tournament status:', error);
    res.status(500).json({ error: 'Failed to update tournament status' });
  }
});

// Update Valorant tournament map pool (admin only)
router.patch('/tournaments/:id/map-pool', verifyAdminToken, tournamentActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { maps } = req.body;
    const adminId = req.admin.adminId;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    if (!Array.isArray(maps) || maps.length === 0) {
      return res.status(400).json({ error: 'maps must be a non-empty array of map names' });
    }

    // Validate all map names are strings
    if (!maps.every(m => typeof m === 'string' && m.trim().length > 0)) {
      return res.status(400).json({ error: 'All map entries must be non-empty strings' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Enforce 7-map requirement for VALORANT (map veto: 6 bans + 1 decider)
    if (tournament.gameTitle === 'VALORANT' && maps.length !== 7) {
      return res.status(400).json({
        error: `Valorant map veto requires exactly 7 maps (6 bans + 1 decider). Got ${maps.length}.`
      });
    }

    const sanitizedMaps = maps.map(m => sanitizeString(m));
    tournament.gameSettings = { ...(tournament.gameSettings || {}), maps: sanitizedMaps };
    await tournament.save();

    console.log(`Admin ${adminId} updated map pool for tournament ${id}: ${sanitizedMaps.join(', ')}`);

    res.json({
      message: 'Map pool updated successfully',
      maps: sanitizedMaps,
      tournamentId: id,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error updating map pool:', error);
    res.status(500).json({ error: 'Failed to update map pool' });
  }
});

// Get tournaments pending approval (SECURE)
router.get('/tournaments/pending/list', verifyAdminToken, async (req, res) => {
  try {
    const tournaments = await Tournament.find({ _approvalStatus: 'pending' })
      .sort({ _submittedAt: -1, createdAt: -1 })
      .limit(100) // SECURITY: Limit results
      .populate('organizer.organizationRef', 'orgName orgLogo contactEmail')
      .populate('_submittedBy', 'orgName orgLogo')
      .select('-roomCredentials -notes')
      .lean();

    res.json({
      tournaments,
      count: tournaments.length
    });
  } catch (error) {
    console.error('Error fetching pending tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch pending tournaments' });
  }
});

// ==================== ORGANIZATION ROUTES ====================

// Helper function to validate MongoDB ObjectId
const validateOrgId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Rate limiter for organization actions
const orgActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many organization actions from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Approve organization (SECURE)
router.patch('/organizations/:id/approve', verifyAdminToken, orgActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.adminId;

    // SECURITY: Validate ObjectId
    if (!validateOrgId(id)) {
      return res.status(400).json({ error: 'Invalid organization ID format' });
    }

    // SECURITY: Verify organization exists
    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.approvalStatus === 'approved') {
      return res.status(400).json({ error: 'Organization is already approved' });
    }

    // Update organization with approval details
    organization.approvalStatus = 'approved';
    organization.approvedBy = adminId;
    organization.approvalDate = new Date();
    organization.rejectionReason = undefined; // Clear any previous rejection reason

    await organization.save();

    // Send approval email to organization
    try {
      const { sendApprovalEmail } = await import('../config/email.js');
      await sendApprovalEmail(
        organization.email,
        organization.orgName
      );
      console.log(`Approval email sent to ${organization.email}`);
    } catch (emailErr) {
      console.error('Error sending approval email:', emailErr);
    }

    // Log the action for audit trail
    console.log(`Admin ${adminId} approved organization ${id} at ${new Date().toISOString()}`);

    res.json({
      message: 'Organization approved successfully',
      organization: {
        id: organization._id,
        orgName: organization.orgName,
        approvalStatus: organization.approvalStatus,
        approvedBy: organization.approvedBy,
        approvalDate: organization.approvalDate
      }
    });
  } catch (error) {
    console.error('Error approving organization:', error);
    res.status(500).json({ error: 'Failed to approve organization' });
  }
});

// Reject organization (SECURE)
router.patch('/organizations/:id/reject', verifyAdminToken, orgActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.adminId;

    // SECURITY: Validate ObjectId
    if (!validateOrgId(id)) {
      return res.status(400).json({ error: 'Invalid organization ID format' });
    }

    // SECURITY: Validate rejection reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Rejection reason must be at least 10 characters'
      });
    }

    if (reason.length > 500) {
      return res.status(400).json({
        error: 'Rejection reason must not exceed 500 characters'
      });
    }

    const sanitizedReason = reason.trim();

    // SECURITY: Verify organization exists
    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.approvalStatus === 'rejected') {
      return res.status(400).json({ error: 'Organization is already rejected' });
    }

    // Update organization with rejection details
    organization.approvalStatus = 'rejected';
    organization.rejectionReason = sanitizedReason;
    organization.approvedBy = undefined; // Clear any previous approval
    organization.approvalDate = undefined;

    await organization.save();

    // Log the action for audit trail
    console.log(`Admin ${adminId} rejected organization ${id} at ${new Date().toISOString()}`);

    res.json({
      message: 'Organization rejected successfully',
      organization: {
        id: organization._id,
        orgName: organization.orgName,
        approvalStatus: organization.approvalStatus,
        rejectionReason: organization.rejectionReason
      }
    });
  } catch (error) {
    console.error('Error rejecting organization:', error);
    res.status(500).json({ error: 'Failed to reject organization' });
  }
});

// ==================== AEGIS RATING ADMIN ROUTES ====================

// Recalculate ratings for a tournament phase (reverse + reprocess)
router.post('/tournaments/:tournamentId/phases/:phaseName/recalculate-ratings', verifyAdminToken, async (req, res) => {
  try {
    const { tournamentId, phaseName } = req.params;

    if (!validateObjectId(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const { reversePhaseRating, processPhaseCompletion } = await import('../services/aegisRating.js');

    const reversed = await reversePhaseRating(tournamentId, phaseName);
    console.log(`🔄 Admin recalculate: Reversed ${reversed} rating events for phase "${phaseName}"`);

    await processPhaseCompletion(tournament, phaseName);

    res.json({
      success: true,
      reversed,
      message: `Phase "${phaseName}" ratings recalculated.`,
    });
  } catch (error) {
    console.error('Error recalculating phase ratings:', error);
    res.status(500).json({ error: 'Failed to recalculate ratings' });
  }
});

// ==================== MODERATION REPORT ROUTES ====================

// Get user reports with pagination and status filter
router.get('/reports', verifyAdminToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const reason = req.query.reason;

    const query = {};
    if (status && ['open', 'in_review', 'actioned', 'dismissed'].includes(status)) {
      query.status = status;
    }
    if (reason && [
      'harassment',
      'hate_speech',
      'spam',
      'sexual_content',
      'violence',
      'impersonation',
      'scam_fraud',
      'other',
    ].includes(reason)) {
      query.reason = reason;
    }

    const [reports, total] = await Promise.all([
      UserReport.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporter', '_id username profilePicture')
        .populate('target.user', '_id username profilePicture')
        .populate('reviewedBy', '_id username email')
        .lean(),
      UserReport.countDocuments(query),
    ]);

    res.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Update report status and moderation notes
router.patch('/reports/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes = '' } = req.body || {};

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid report ID format' });
    }

    if (!['open', 'in_review', 'actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const report = await UserReport.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          adminNotes: typeof adminNotes === 'string' ? adminNotes.trim() : '',
          reviewedBy: req.admin.adminId,
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    )
      .populate('reporter', '_id username profilePicture')
      .populate('target.user', '_id username profilePicture')
      .populate('reviewedBy', '_id username email')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    console.error('Admin update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// ==================== TOURNAMENT GROUP MANAGEMENT ROUTES ====================

// Get all teams in a phase (with their group assignments) — used by group manager UI
router.get('/tournaments/:id/phase-teams', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phase } = req.query;

    if (!validateObjectId(id)) return res.status(400).json({ error: 'Invalid tournament ID' });
    if (!phase) return res.status(400).json({ error: '"phase" query param required' });

    const tournament = await Tournament.findById(id).select('phases').lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (!tournament.phases?.some(p => p.name === phase)) {
      return res.status(404).json({ error: `Phase "${phase}" not found` });
    }

    const registrations = await Registration.find({
      tournament: id,
      phase,
      status: { $nin: ['rejected', 'withdrawn'] }
    })
      .populate('team', 'teamName teamTag logo')
      .select('team group status')
      .lean();

    res.json({
      phase,
      teams: registrations
        .filter(r => r.team)
        .map(r => ({
          _id: r.team._id,
          teamName: r.team.teamName,
          teamTag: r.team.teamTag,
          logo: r.team.logo,
          group: r.group || null,
          registrationId: r._id,
        }))
    });
  } catch (error) {
    console.error('Error fetching phase teams:', error);
    res.status(500).json({ error: 'Failed to fetch phase teams' });
  }
});

// Assign teams to groups — writes to Registration.group + Tournament.phases[].groups
router.put('/tournaments/:id/assign-groups', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phase, groups } = req.body;

    if (!validateObjectId(id)) return res.status(400).json({ error: 'Invalid tournament ID' });
    if (!phase || !Array.isArray(groups)) {
      return res.status(400).json({ error: '"phase" and "groups" array are required' });
    }

    const tournament = await Tournament.findById(id).select('phases status').lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const phaseDoc = tournament.phases?.find(p => p.name === phase);
    if (!phaseDoc) return res.status(404).json({ error: `Phase "${phase}" not found` });

    // Build bulk ops — one updateOne per team per group
    const bulkOps = [];
    for (const group of groups) {
      if (!group.name || !Array.isArray(group.teams)) continue;
      for (const teamId of group.teams) {
        if (!validateObjectId(teamId)) continue;
        bulkOps.push({
          updateOne: {
            filter: { tournament: id, team: teamId, phase },
            update: { $set: { group: group.name } }
          }
        });
      }
    }

    // Clear group on teams not included in the payload
    const allIncludedTeamIds = groups.flatMap(g => (g.teams || []));
    bulkOps.push({
      updateMany: {
        filter: {
          tournament: id,
          phase,
          team: { $nin: allIncludedTeamIds.filter(tid => validateObjectId(tid)) }
        },
        update: { $set: { group: '' } }
      }
    });

    if (bulkOps.length > 0) {
      await Registration.bulkWrite(bulkOps, { ordered: false });
    }

    // Persist group metadata (slotList) to tournament doc
    const groupMetadata = groups
      .filter(g => g.name)
      .map(g => {
        const existingGroup = (phaseDoc.groups || []).find(eg => eg.name === g.name);
        const slotList = (g.teams || [])
          .filter(tid => validateObjectId(tid))
          .map((teamId, idx) => ({
            slot: idx < 23 ? idx + 3 : 2,
            team: teamId
          }));
        return {
          name: g.name,
          teams: [],
          isLocked: existingGroup?.isLocked || false,
          slotList
        };
      });

    await Tournament.updateOne(
      { _id: id, 'phases._id': phaseDoc._id },
      { $set: { 'phases.$.groups': groupMetadata } }
    );

    res.json({
      success: true,
      message: `Groups saved for phase "${phase}"`,
      groupsCreated: groups.length,
      teamsAssigned: allIncludedTeamIds.length
    });
  } catch (error) {
    console.error('Error assigning groups:', error);
    res.status(500).json({ error: 'Failed to assign groups' });
  }
});

export default router;