import express from 'express';
import Admin from '../models/admin.model.js';
import { generateAdminToken, verifyAdminToken } from '../middleware/adminAuth.js';
import rateLimit from 'express-rate-limit';
import Tournament from '../models/tournament.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';

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
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
    const registrations = await Registration.find({ status: { $in: ['approved', 'checked_in'] } }).populate('roster.player', '_id');
    const playerIds = new Set();
    registrations.forEach(reg => {
      if (reg.roster && Array.isArray(reg.roster)) {
        reg.roster.forEach(member => {
          if (member.player && member.player._id) {
            playerIds.add(String(member.player._id));
          }
        });
      }
    });
    const totalPlayers = playerIds.size;

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
        .populate('participatingTeams.team', 'teamName teamTag logo aegisRating')
        .select('-participatingTeams.kills.breakdown -roomCredentials.password') // Exclude sensitive data
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

export default router;