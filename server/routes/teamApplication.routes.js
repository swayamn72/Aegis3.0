// server/routes/teamApplication.routes.js
import mongoose from 'mongoose';
import express from 'express';
import TeamApplication from '../models/teamApplication.model.js';
import TryoutChat from '../models/tryoutChat.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import auth from '../middleware/auth.js';

const router = express.Router();

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
        'username inGameName realName profilePicture aegisRating primaryGame inGameRole statistics availability'
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
      messages: [
        {
          sender: req.user.id,
          message: `Tryout started for ${application.player.username}. Welcome to the team tryout!`,
          messageType: 'system',
        },
      ],
      status: 'active',
    });

    await tryoutChat.save();

    // Update application
    application.status = 'in_tryout';
    application.tryoutChatId = tryoutChat._id;
    application.tryoutStartedAt = new Date();
    await application.save();

    await tryoutChat
      .populate('participants', 'username profilePicture inGameName')
      .populate('team', 'teamName teamTag logo')
      .populate('applicant', 'username profilePicture inGameName');

    res.json({
      message: 'Tryout started successfully',
      application,
      tryoutChat,
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
        $push: {
          messages: {
            sender: req.user.id,
            message: `${application.player.username} has been accepted to the team! Welcome aboard! 🎉`,
            messageType: 'system',
          },
        },
      });
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
        $push: {
          messages: {
            sender: req.user.id,
            message: `Tryout has ended. Thank you for your time, ${application.player.username}.`,
            messageType: 'system',
          },
        },
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