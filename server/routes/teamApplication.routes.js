// server/routes/teamApplication.routes.js
import mongoose from 'mongoose';
import express from 'express';
import TeamApplication from '../models/teamApplication.model.js';
import TryoutChat from '../models/tryoutChat.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import auth from '../middleware/auth.js';
import { deactivateLFTPost, deactivateLFPPost } from '../utils/recruitmentHelpers.js';
import { createTryoutMessage, fetchTryoutMessages } from '../services/tryoutMessage.service.js';


const router = express.Router();
const MAX_APPLICATION_MESSAGE_LEN = 500;
const MAX_APPLIED_ROLES = 5;
const ALLOWED_ROLES = ['IGL', 'Assaulter', 'Support', 'Sniper', 'Fragger'];

router.get('/recruiting-teams', async (req, res) => {
  try {
    const {
      game,
      region,
      role,
      limit: rawLimit = '20',
      page: rawPage = '1',
      sortBy = 'aegisRating', // optional: allow sorting
      sortDir = 'desc'
    } = req.query;

    // sanitize & caps
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 50); // 1..50
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = (page - 1) * limit;

    // Build match filter (only fields required for match)
    const match = {
      lookingForPlayers: true,
      status: 'active',
      profileVisibility: 'public',
    };

    if (game) match.primaryGame = game;
    if (region) match.region = region;
    if (role) {
      // openRoles is likely an array -> use $in
      match.openRoles = { $in: [role] };
    }

    // Sort handling (whitelist)
    const allowedSort = {
      aegisRating: { aegisRating: sortDir === 'asc' ? 1 : -1 },
      createdAt: { createdAt: sortDir === 'asc' ? 1 : -1 },
      aegisRating_createdAt: { aegisRating: -1, createdAt: -1 }
    };
    const sort = allowedSort[sortBy] || allowedSort['aegisRating'];

    // Aggregation: match -> add playersCount -> lookup captain -> project -> facet for pagination + total
    const agg = [
      { $match: match },

      // playersCount field without fetching full players array
      { $addFields: { playersCount: { $size: { $ifNull: ['$players', []] } } } },

      // Lookup a minimal captain object
      {
        $lookup: {
          from: 'players',
          localField: 'captain',
          foreignField: '_id',
          as: 'captain'
        }
      },
      { $unwind: { path: '$captain', preserveNullAndEmptyArrays: true } },

      // Project only fields needed for list view
      {
        $project: {
          teamName: 1,
          teamTag: 1,
          logo: 1,
          primaryGame: 1,
          region: 1,
          openRoles: 1,
          aegisRating: 1,
          statistics: 1,
          bio: 1,
          establishedDate: 1,
          totalEarnings: 1,
          playersCount: 1,
          'captain._id': 1,
          'captain.username': 1,
          'captain.profilePicture': 1,
          'captain.aegisRating': 1
        }
      },

      { $sort: sort },

      // Facet: results + total count
      {
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [aggResult] = await Team.aggregate(agg).exec();
    const teams = (aggResult && aggResult.paginatedResults) || [];
    const total = (aggResult && aggResult.totalCount[0] && aggResult.totalCount[0].count) || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      teams,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching recruiting teams:', error);
    res.status(500).json({ error: 'Failed to fetch recruiting teams' });
  }
});

// POST /api/team-applications/apply - Apply to a team (player only)
router.post('/apply', auth, async (req, res) => {
  try {
    const { teamId, message = '', appliedRoles = [] } = req.body || {};

    if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const player = await Player.findById(req.user.id).select('username team inGameRole');
    if (!player) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    if (player.team) {
      return res.status(400).json({ error: 'You are already in a team' });
    }

    const team = await Team.findById(teamId).select('captain players teamName status profileVisibility');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.status !== 'active' || team.profileVisibility !== 'public') {
      return res.status(400).json({ error: 'Team is not accepting applications right now' });
    }

    if (team.captain?.toString() === req.user.id.toString()) {
      return res.status(400).json({ error: 'You cannot apply to your own team' });
    }

    if (Array.isArray(team.players) && team.players.some((p) => p.toString() === req.user.id.toString())) {
      return res.status(400).json({ error: 'You are already in this team' });
    }

    if (Array.isArray(team.players) && team.players.length >= 5) {
      return res.status(400).json({ error: 'Team roster is full' });
    }

    const cleanMessage = String(message).trim().slice(0, MAX_APPLICATION_MESSAGE_LEN);
    let cleanRoles = [];
    if (Array.isArray(appliedRoles)) {
      cleanRoles = appliedRoles
        .map((role) => String(role).trim())
        .filter((role) => ALLOWED_ROLES.includes(role))
        .slice(0, MAX_APPLIED_ROLES);
    }

    const existingApplication = await TeamApplication.findOne({
      team: team._id,
      player: player._id,
    });

    if (existingApplication) {
      if (existingApplication.status === 'pending' || existingApplication.status === 'in_tryout') {
        return res.status(400).json({ error: 'You already have an active application for this team' });
      }

      if (existingApplication.status === 'accepted') {
        return res.status(400).json({ error: 'Your application to this team has already been accepted' });
      }

      existingApplication.status = 'pending';
      existingApplication.message = cleanMessage;
      existingApplication.appliedRoles = cleanRoles;
      existingApplication.tryoutChatId = null;
      existingApplication.rejectionReason = '';
      existingApplication.tryoutStartedAt = undefined;
      existingApplication.tryoutEndedAt = undefined;
      await existingApplication.save();

      const updatedApplication = await TeamApplication.findById(existingApplication._id)
        .populate('team', 'teamName teamTag logo')
        .populate('player', 'username profilePicture inGameRole');

      return res.json({
        message: 'Application submitted successfully',
        application: updatedApplication,
      });
    }

    const application = await TeamApplication.create({
      team: team._id,
      player: player._id,
      message: cleanMessage,
      appliedRoles: cleanRoles,
      status: 'pending',
    });

    const populatedApplication = await TeamApplication.findById(application._id)
      .populate('team', 'teamName teamTag logo')
      .populate('player', 'username profilePicture inGameRole');

    return res.status(201).json({
      message: 'Application submitted successfully',
      application: populatedApplication,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(400).json({ error: 'You already applied to this team' });
    }

    console.error('Error applying to team:', error);
    return res.status(500).json({ error: 'Failed to submit application' });
  }
});

// GET /api/team-applications/team/:teamId - Get applications for a team (captain only)
router.get('/team/:teamId', auth, async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    // Verify user is team captain
    const team = await Team.findById(teamId).select('captain').lean();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!team.captain) {
      console.error('Team captain is undefined for team:', teamId);
      return res.status(500).json({ error: 'Team captain information missing' });
    }

    if (team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captain can view applications' });
    }

    const applications = await TeamApplication.find({
      team: teamId,
      status: { $in: ['pending', 'in_tryout'] },
    })
      .populate(
        'player',
        'username realName profilePicture aegisRating primaryGame inGameRole statistics availability'
      )
      .sort({ createdAt: -1 })
      .lean();

    res.json({ applications });
  } catch (error) {
    console.error('Error fetching team applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// POST /api/team-applications/:applicationId/start-tryout - Start tryout (captain only)
router.post('/:applicationId/start-tryout', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const application = await TeamApplication.findById(applicationId)
      .populate('team', 'teamName teamTag logo players captain')
      .populate('player', 'username profilePicture');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!application.team) {
      return res.status(400).json({ error: 'Team not found for this application' });
    }

    // Verify user is team captain
    if (application.team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captain can start tryouts' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application is not in pending status' });
    }

    if (application.tryoutChatId) {
      return res.status(400).json({ error: 'Tryout already started for this application' });
    }

    const participants = [
      ...new Set([
        ...application.team.players.map(p => p.toString()),
        application.player._id.toString(),
      ]),
    ];

    // Create tryout chat
    const tryoutChat = new TryoutChat({
      application: application._id,
      team: application.team._id,
      applicant: application.player._id,
      participants,
      status: 'active',
    });

    await tryoutChat.save();
    await createTryoutMessage({
      chatId: tryoutChat._id,
      sender: req.user.id,
      message: `Tryout started for ${application.player.username}. Welcome to the team tryout!`,
      messageType: 'system',
      timestamp: new Date(),
    });

    // Update application
    application.status = 'in_tryout';
    application.tryoutChatId = tryoutChat._id;
    application.tryoutStartedAt = new Date();
    await application.save();

    await tryoutChat
      .populate('participants', 'username profilePicture')
      .populate('team', 'teamName teamTag logo')
      .populate('applicant', 'username profilePicture');

    const hydratedTryoutChat = {
      ...tryoutChat.toObject(),
      messages: await fetchTryoutMessages(tryoutChat._id),
    };

    res.json({
      message: 'Tryout started successfully',
      application,
      tryoutChat: hydratedTryoutChat,
    });
  } catch (error) {
    console.error('Error starting tryout:', error);
    res.status(500).json({ error: 'Failed to start tryout' });
  }
});

// POST /api/team-applications/:applicationId/accept - Accept player (captain only)
router.post('/:applicationId/accept', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { notes } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const application = await TeamApplication.findById(applicationId)
      .populate('team', 'captain players')
      .populate('player', 'username team');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!application.team) {
      return res.status(400).json({ error: 'Team not found for this application' });
    }

    if (!application.player) {
      return res.status(400).json({ error: 'Player not found for this application' });
    }

    // Verify user is team captain
    if (application.team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captain can accept players' });
    }

    if (application.status !== 'in_tryout') {
      return res.status(400).json({ error: 'Player must be in tryout to be accepted' });
    }

    // Check if team is full
    if (application.team.players.length >= 5) {
      return res.status(400).json({ error: 'Team roster is full' });
    }

    // Check if player is already in a team
    if (application.player.team) {
      return res.status(400).json({ error: 'Player is already in a team' });
    }

    // Add player to team
    application.team.players.push(application.player._id);
    await application.team.save();

    // Update player
    await Player.findByIdAndUpdate(application.player._id, {
      team: application.team._id,
      teamStatus: 'in a team',
    });

    // Update application
    application.status = 'accepted';
    application.captainNotes = notes || '';
    application.tryoutEndedAt = new Date();
    await application.save();

    // Close tryout chat
    if (application.tryoutChatId) {
      await TryoutChat.findByIdAndUpdate(application.tryoutChatId, {
        status: 'completed',
        endedAt: new Date(),
      });
      await createTryoutMessage({
        chatId: application.tryoutChatId,
        sender: req.user.id,
        message: `${application.player.username} has been accepted to the team! Welcome aboard! 🎉`,
        messageType: 'system',
        timestamp: new Date(),
      });
    }

    // Deactivate any active LFT posts for the player who joined
    await deactivateLFTPost(application.player._id);

    // If team roster is now full (5 players), deactivate their LFP post
    if (application.team.players.length >= 5) {
      await deactivateLFPPost(application.team._id);
    }


    res.json({
      message: 'Player accepted successfully',
      application,
    });
  } catch (error) {
    console.error('Error accepting player:', error);
    res.status(500).json({ error: 'Failed to accept player' });
  }
});

// POST /api/team-applications/:applicationId/reject - Reject player (captain only)
router.post('/:applicationId/reject', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const application = await TeamApplication.findById(applicationId)
      .populate('team', 'captain')
      .populate('player', 'username');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!application.team) {
      return res.status(400).json({ error: 'Team not found for this application' });
    }

    // Verify user is team captain
    if (application.team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captain can reject players' });
    }

    if (!['pending', 'in_tryout'].includes(application.status)) {
      return res.status(400).json({ error: 'Cannot reject application in current status' });
    }

    // Update application
    application.status = 'rejected';
    application.rejectionReason = reason || '';
    application.tryoutEndedAt = new Date();
    await application.save();

    // Close tryout chat if exists
    if (application.tryoutChatId) {
      await TryoutChat.findByIdAndUpdate(application.tryoutChatId, {
        status: 'completed',
        endedAt: new Date(),
      });
      await createTryoutMessage({
        chatId: application.tryoutChatId,
        sender: req.user.id,
        message: `Tryout has ended. Thank you for your time, ${application.player.username}.`,
        messageType: 'system',
        timestamp: new Date(),
      });
    }

    res.json({
      message: 'Application rejected',
      application,
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

export default router;