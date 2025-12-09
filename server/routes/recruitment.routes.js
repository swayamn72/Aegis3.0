import express from 'express';
import LFTPost from '../models/lftPost.model.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import RecruitmentApproach from '../models/recruitmentApproach.model.js';
import TryoutChat from '../models/tryoutChat.model.js';
import ChatMessage from '../models/chat.model.js';
import auth from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/my-approaches', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const player = await Player.findById(userId)
      .select('team')
      .lean();

    if (!player) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    const orConditions = [
      { player: userId }, // approaches TO this player
    ];

    // If player is in a team, and is captain, also include approaches FROM that team
    if (player.team && mongoose.Types.ObjectId.isValid(player.team)) {
      const team = await Team.findById(player.team).select('captain').lean();

      if (team && team.captain?.toString() === userId.toString()) {
        orConditions.push({ team: team._id });
      }
    }

    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100);

    const approaches = await RecruitmentApproach.find({
      $or: orConditions,
    })
      .populate('team', 'teamName logo')
      .populate('player', 'username profilePicture aegisRating')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ approaches });
  } catch (error) {
    console.error('Error fetching approaches:', error);
    res.status(500).json({ error: 'Failed to fetch approaches' });
  }
});

router.post('/approach/:approachId/accept', auth, async (req, res) => {
  try {
    const { approachId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(approachId)) {
      return res.status(400).json({ error: 'Invalid approach ID' });
    }

    // Atomically mark approach as accepted if still pending
    let approach = await RecruitmentApproach.findOneAndUpdate(
      { _id: approachId, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    )
      .populate('team')
      .populate('player');

    if (!approach) {
      return res.status(400).json({ error: 'This approach has already been processed or does not exist' });
    }

    if (!approach.player) {
      return res.status(400).json({ error: 'Player not found for this approach' });
    }

    if (approach.player._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'This approach is not for you' });
    }

    if (!approach.team) {
      return res.status(400).json({ error: 'Team not found for this approach' });
    }

    const team = await Team.findById(approach.team._id).populate('players captain');
    if (!team) {
      return res.status(400).json({ error: 'Team no longer exists' });
    }

    const allParticipants = [
      ...team.players.map(p => p._id),
      approach.player._id
    ];

    const uniqueParticipants = [
      ...new Map(allParticipants.map(id => [id.toString(), id])).values()
    ];

    const tryoutChat = new TryoutChat({
      team: team._id,
      applicant: approach.player._id,
      participants: uniqueParticipants,
      status: 'active',
      chatType: 'recruitment',
      metadata: {
        approachId: approach._id,
        initiatedBy: 'team'
      },
      messages: [
        {
          sender: 'system',
          message: `${approach.player.username} has accepted the recruitment approach from ${team.teamName}. All team members can now discuss opportunities.`,
          messageType: 'system',
          timestamp: new Date()
        }
      ]
    });

    await tryoutChat.save();

    // Link tryout chat back to approach
    approach.tryoutChatId = tryoutChat._id;
    await approach.save();

    await ChatMessage.updateOne(
      { 'metadata.approachId': approachId },
      { $set: { 'metadata.approachStatus': 'accepted' } }
    );

    await tryoutChat.populate('team applicant participants');

    res.json({
      message: 'Approach accepted and tryout chat created',
      tryoutChat
    });
  } catch (error) {
    console.error('Error accepting approach:', error);
    res.status(500).json({ error: 'Failed to accept approach' });
  }
});

router.post('/approach/:approachId/reject', auth, async (req, res) => {
  try {
    const { approachId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(approachId)) {
      return res.status(400).json({ error: 'Invalid approach ID' });
    }

    // Atomically reject only if it's still pending and belongs to this user
    const approach = await RecruitmentApproach.findOneAndUpdate(
      { _id: approachId, player: req.user.id, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason || 'Not interested',
        },
      },
      { new: true }
    );

    if (!approach) {
      return res.status(400).json({ error: 'This approach has already been processed or does not exist' });
    }

    await ChatMessage.updateOne(
      { 'metadata.approachId': approachId },
      { $set: { 'metadata.approachStatus': 'rejected' } }
    );

    res.json({ message: 'Approach rejected' });
  } catch (error) {
    console.error('Error rejecting approach:', error);
    res.status(500).json({ error: 'Failed to reject approach' });
  }
});


export default router;