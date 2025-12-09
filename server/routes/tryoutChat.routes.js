// server/routes/tryoutChat.routes.js
import mongoose from 'mongoose';
import express from 'express';
import TryoutChat from '../models/tryoutChat.model.js';
import Team from '../models/team.model.js';
import TeamApplication from '../models/teamApplication.model.js';
import Player from '../models/player.model.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// IMPORTANT: /my-chats MUST come BEFORE /:chatId
// GET /api/tryout-chats/my-chats - Get all active tryout chats user is part of
router.get('/my-chats', auth, async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);

    const chats = await TryoutChat.find({
      participants: req.user.id,
      status: 'active',
    })
      .populate('team', 'teamName teamTag logo')
      .populate('applicant', 'username inGameName profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ chats });
  } catch (error) {
    console.error('Error fetching tryout chats:', error);
    res.status(500).json({ error: 'Failed to fetch tryout chats' });
  }
});

// GET /api/tryout-chats/:chatId - Get specific tryout chat
router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    // Combine auth + lookup in one query
    const chat = await TryoutChat.findOne({
      _id: chatId,
      participants: req.user.id,
    })
      .populate('team', 'teamName teamTag logo captain')
      .populate('applicant', 'username inGameName profilePicture')
      .populate('participants', 'username profilePicture inGameName')
      .populate({
        path: 'messages.sender',
        select: 'username profilePicture',
      })
      .lean();

    if (!chat) {
      // Could be "not found" or "not authorized", but leaking which is which is unnecessary.
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    console.error('Error fetching tryout chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// NEW: End tryout (either party can call this)
router.post('/:chatId/end-tryout', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chat = await TryoutChat.findById(chatId)
      .populate('team', 'teamName captain')
      .populate('applicant', 'username');

    if (!chat) {
      return res.status(404).json({ error: 'Tryout chat not found' });
    }

    if (!chat.team || !chat.team.captain) {
      return res.status(400).json({ error: 'Team data not available for this tryout' });
    }

    if (!chat.applicant) {
      return res.status(400).json({ error: 'Applicant data not available for this tryout' });
    }

    const isTeamCaptain = chat.team.captain.toString() === userId;
    const isApplicant = chat.applicant._id.toString() === userId;

    if (!isTeamCaptain && !isApplicant) {
      return res.status(403).json({ error: 'Not authorized to end this tryout' });
    }

    if (['ended_by_team', 'ended_by_player', 'offer_sent', 'offer_accepted', 'offer_rejected'].includes(chat.tryoutStatus)) {
      return res.status(400).json({ error: 'Tryout already ended or offer in progress' });
    }

    chat.tryoutStatus = isTeamCaptain ? 'ended_by_team' : 'ended_by_player';
    chat.endedAt = new Date();
    chat.endedBy = userId;
    chat.endedByModel = isTeamCaptain ? 'Team' : 'Player';
    chat.endReason = reason || 'No reason provided';

    const systemMessage = {
      sender: 'system',
      message: `Tryout ended by ${isTeamCaptain ? chat.team.teamName : chat.applicant.username}. Reason: ${chat.endReason}`,
      messageType: 'system',
      timestamp: new Date()
    };
    chat.messages.push(systemMessage);

    await chat.save();

    if (global.io) {
      global.io.to(`tryout_${chatId}`).emit('tryoutEnded', {
        chatId,
        tryoutStatus: chat.tryoutStatus,
        endedBy: isTeamCaptain ? 'team' : 'player',
        reason: chat.endReason,
        message: systemMessage
      });
    }

    res.json({
      message: 'Tryout ended successfully',
      chat
    });
  } catch (error) {
    console.error('Error ending tryout:', error);
    res.status(500).json({ error: 'Failed to end tryout' });
  }
});

// NEW: Send team join offer (team captain only)
router.post('/:chatId/send-offer', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chat = await TryoutChat.findById(chatId)
      .populate('team', 'teamName captain logo players')
      .populate('applicant', 'username');

    if (!chat) {
      return res.status(404).json({ error: 'Tryout chat not found' });
    }

    if (!chat.team || !chat.team.captain) {
      return res.status(400).json({ error: 'Team data is invalid for this tryout' });
    }

    if (!chat.applicant) {
      return res.status(400).json({ error: 'Applicant data is invalid for this tryout' });
    }

    if (chat.team.captain.toString() !== userId) {
      return res.status(403).json({ error: 'Only team captain can send offers' });
    }

    if (chat.tryoutStatus !== 'active') {
      return res.status(400).json({ error: 'Tryout is not active' });
    }

    if (chat.team.players.length >= 5) {
      return res.status(400).json({ error: 'Team is already full (max 5 players)' });
    }

    // Optional but recommended: ensure applicant is still teamless
    const applicantDoc = await Player.findById(chat.applicant._id).select('team');
    if (applicantDoc?.team) {
      return res.status(400).json({ error: 'Player is already in a team' });
    }

    chat.tryoutStatus = 'offer_sent';
    chat.teamOffer = {
      status: 'pending',
      sentAt: new Date(),
      message: message || `${chat.team.teamName} would like to invite you to join the team!`
    };

    const systemMessage = {
      sender: 'system',
      message: `${chat.team.teamName} has sent you a team join offer! Check the message above to accept or decline.`,
      messageType: 'team_offer',
      metadata: {
        offerMessage: chat.teamOffer.message,
        teamName: chat.team.teamName,
        teamLogo: chat.team.logo
      },
      timestamp: new Date()
    };
    chat.messages.push(systemMessage);

    await chat.save();

    if (global.io) {
      global.io.to(`tryout_${chatId}`).emit('teamOfferSent', {
        chatId,
        offer: chat.teamOffer,
        message: systemMessage
      });
    }

    res.json({
      message: 'Team offer sent successfully',
      chat
    });
  } catch (error) {
    console.error('Error sending team offer:', error);
    res.status(500).json({ error: 'Failed to send team offer' });
  }
});

// NEW: Accept team offer (applicant only)
router.post('/:chatId/accept-offer', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chat = await TryoutChat.findById(chatId)
      .populate('team')
      .populate('applicant');

    if (!chat) {
      return res.status(404).json({ error: 'Tryout chat not found' });
    }

    if (!chat.applicant) {
      return res.status(400).json({ error: 'Applicant data missing for this tryout' });
    }

    if (!chat.team) {
      return res.status(400).json({ error: 'Team data missing for this tryout' });
    }

    if (!chat.teamOffer) {
      return res.status(400).json({ error: 'No team offer found for this tryout' });
    }

    // Only applicant can accept
    if (chat.applicant._id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the applicant can accept this offer' });
    }

    // Tryout must be in offer_sent state
    if (chat.tryoutStatus !== 'offer_sent') {
      return res.status(400).json({ error: 'No active offer to accept' });
    }

    // Offer must be pending
    if (chat.teamOffer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer is no longer pending' });
    }

    const player = await Player.findById(userId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.team) {
      return res.status(400).json({ error: 'You are already in a team' });
    }

    const team = await Team.findById(chat.team._id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.players.length >= 5) {
      return res.status(400).json({ error: 'Team is already full' });
    }

    // Add player to team
    team.players.push(userId);
    await team.save();

    // Update player
    player.team = team._id;
    player.teamStatus = 'in a team';
    await player.save();

    // Update chat + offer
    chat.tryoutStatus = 'offer_accepted';
    chat.teamOffer.status = 'accepted';
    chat.teamOffer.respondedAt = new Date();

    const systemMessage = {
      sender: 'system',
      message: `🎉 ${chat.applicant.username} has joined ${team.teamName}!`,
      messageType: 'system',
      timestamp: new Date()
    };
    chat.messages.push(systemMessage);

    await chat.save();

    // Mark team application accepted if exists
    const application = await TeamApplication.findOne({
      player: userId,
      team: team._id,
      status: 'in_tryout'
    });

    if (application) {
      application.status = 'accepted';
      application.tryoutEndedAt = new Date();
      await application.save();
    }

    if (global.io) {
      global.io.to(`tryout_${chatId}`).emit('teamOfferAccepted', {
        chatId,
        message: systemMessage
      });
    }

    res.json({
      message: 'Team offer accepted successfully',
      chat,
      team
    });
  } catch (error) {
    console.error('Error accepting team offer:', error);
    res.status(500).json({ error: 'Failed to accept team offer' });
  }
});

// NEW: Reject team offer (applicant only)
router.post('/:chatId/reject-offer', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chat = await TryoutChat.findById(chatId)
      .populate('team', 'teamName')
      .populate('applicant', 'username');

    if (!chat) {
      return res.status(404).json({ error: 'Tryout chat not found' });
    }

    if (!chat.applicant) {
      return res.status(400).json({ error: 'Applicant data missing for this tryout' });
    }

    if (!chat.team) {
      return res.status(400).json({ error: 'Team data missing for this tryout' });
    }

    if (!chat.teamOffer) {
      return res.status(400).json({ error: 'No team offer found for this tryout' });
    }

    // Only applicant can reject
    if (chat.applicant._id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the applicant can reject this offer' });
    }

    // Tryout must be at offer_sent
    if (chat.tryoutStatus !== 'offer_sent') {
      return res.status(400).json({ error: 'No active offer to reject' });
    }

    // Offer must be pending
    if (chat.teamOffer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer is no longer pending' });
    }

    // Update chat state
    chat.tryoutStatus = 'offer_rejected';
    chat.teamOffer.status = 'rejected';
    chat.teamOffer.respondedAt = new Date();

    const systemMessage = {
      sender: 'system',
      message: `${chat.applicant.username} has declined the team offer. Reason: ${reason || 'Not specified'}`,
      messageType: 'system',
      timestamp: new Date()
    };
    chat.messages.push(systemMessage);

    await chat.save();

    if (global.io) {
      global.io.to(`tryout_${chatId}`).emit('teamOfferRejected', {
        chatId,
        reason: reason || null,
        message: systemMessage
      });
    }

    res.json({
      message: 'Team offer rejected',
      chat
    });
  } catch (error) {
    console.error('Error rejecting team offer:', error);
    res.status(500).json({ error: 'Failed to reject team offer' });
  }
});


export default router;