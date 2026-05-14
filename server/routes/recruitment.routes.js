import express from 'express';
import LFTPost from '../models/lftPost.model.js';
import LFPPost from '../models/lfpPost.model.js';
import LFPSwipe from '../models/lfpSwipe.model.js';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import RecruitmentApproach from '../models/recruitmentApproach.model.js';
import TryoutChat from '../models/tryoutChat.model.js';
import ChatMessage from '../models/chat.model.js';
import auth from '../middleware/auth.js';
import mongoose from 'mongoose';
import { createTryoutMessage, fetchTryoutMessages } from '../services/tryoutMessage.service.js';
import notificationService from '../services/notification.service.js';

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

const MAX_MESSAGE_LEN = 500; // Updated to match recruitmentApproach.model.js
const MAX_TEAM_PLAYERS = 5;

router.post('/approach-player/:playerId', auth, async (req, res) => {
  const session = await mongoose.startSession().catch(() => null);
  try {
    const { playerId } = req.params;
    let { message = '' } = req.body || {};

    // Validate playerId
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid playerId' });
    }

    // sanitize + cap message
    message = String(message || '').trim().slice(0, MAX_MESSAGE_LEN);
    if (!message) {
      // allow empty but prefer a short default message
      message = 'We would like to discuss recruitment opportunities with you.';
    }

    // Get caller + team (ensure player exists)
    const caller = await Player.findById(req.user.id).populate('team', 'teamName captain players logo');
    if (!caller) return res.status(400).json({ error: 'Caller profile not found' });

    const team = caller.team;
    if (!team) return res.status(400).json({ error: 'You must be in a team to approach players' });

    // confirm caller is captain
    if (!team.captain || team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captains can approach players' });
    }

    // Prevent approaching yourself
    if (playerId === req.user.id.toString()) {
      return res.status(400).json({ error: 'You cannot approach yourself' });
    }

    // target player exists
    const targetPlayer = await Player.findById(playerId).select('username team profileVisibility');
    if (!targetPlayer) {
      return res.status(404).json({ error: 'Target player not found' });
    }

    // Prevent targeting players already in this team
    if (String(targetPlayer.team || '') === String(team._id)) {
      return res.status(400).json({ error: 'Player is already in your team' });
    }

    // Prevent approaching players who are already in *any* team
    if (targetPlayer.team) {
      return res.status(400).json({ error: 'Player is already in another team' });
    }


    // Optional: prevent if team full
    if (Array.isArray(team.players) && team.players.length >= MAX_TEAM_PLAYERS) {
      return res.status(400).json({ error: 'Your team roster is full' });
    }

    // Allow a new approach only if the last one is older than 7 days
    const lastApproach = await RecruitmentApproach.findOne({
      team: team._id,
      player: targetPlayer._id
    }).sort({ createdAt: -1 });

    if (lastApproach) {
      const now = new Date();
      const diffMs = now - lastApproach.createdAt;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        return res.status(400).json({ error: 'You can only send a new approach to this player after 7 days from the last approach.' });
      }
    }

    // Use transaction when available to create approach + system chat message atomically
    let approachDoc;
    if (session) {
      session.startTransaction();
      approachDoc = await RecruitmentApproach.create([{
        team: team._id,
        player: targetPlayer._id,
        message,
        status: 'pending'
      }], { session });
      approachDoc = approachDoc[0];

      const systemMsg = new ChatMessage({
        senderId: 'system',
        receiverId: targetPlayer._id,
        message,
        messageType: 'system',
        metadata: {
          type: 'recruitment_approach',
          approachId: approachDoc._id,
          teamName: team.teamName,
          teamLogo: team.logo,
          approachStatus: 'pending'
        },
        timestamp: new Date()
      });

      await systemMsg.save({ session });

      await session.commitTransaction();
      session.endSession();

    } else {
      // fallback for standalone mongod (no transactions) — create, handle duplicate key if index exists
      try {
        approachDoc = new RecruitmentApproach({
          team: team._id,
          player: targetPlayer._id,
          message,
          status: 'pending'
        });
        await approachDoc.save();

        const systemMsg = new ChatMessage({
          senderId: 'system',
          receiverId: targetPlayer._id,
          message,
          messageType: 'system',
          metadata: {
            type: 'recruitment_approach',
            approachId: approachDoc._id,
            teamName: team.teamName,
            teamLogo: team.logo,
            approachStatus: 'pending'
          },
          timestamp: new Date()
        });
        await systemMsg.save();
      } catch (err) {
        // handle race/duplicate if you implement unique partial index
        if (err && err.code === 11000) {
          return res.status(400).json({ error: 'You already have a pending approach with this player' });
        }
        throw err;
      }
    }

    // Emit socket message (if connected)
    const io = req.app.get('io');
    if (io) {
      io.to(String(targetPlayer._id)).emit('receiveMessage', {
        _id: `sys_${Date.now()}`,
        senderId: 'system',
        receiverId: String(targetPlayer._id),
        message,
        messageType: 'system',
        metadata: {
          type: 'recruitment_approach',
          approachId: approachDoc._id,
          teamName: team.teamName,
          teamLogo: team.logo,
          approachStatus: 'pending'
        },
        timestamp: new Date()
      });
    }

    notificationService
      .sendToPlayer(
        String(targetPlayer._id),
        'New Recruitment Approach',
        `${team.teamName} wants to recruit you.`,
        {
          type: 'recruitment_approach',
          directUserId: 'system',
          approachId: String(approachDoc._id),
          teamId: String(team._id),
          teamName: team.teamName,
        }
      )
      .catch((err) => {
        console.error('Recruitment approach notification error:', err);
      });

    // Minimal response
    await approachDoc.populate('team', 'teamName logo');
    res.status(201).json({ message: 'Approach request sent successfully', approach: approachDoc });

  } catch (error) {
    console.error('Error sending approach request:', error);
    // If transaction started but failed, ensure session closed
    try { if (session && session.inTransaction()) { await session.abortTransaction(); session.endSession(); } } catch (_) { }
    res.status(500).json({ error: 'Failed to send approach request' });
  }
});


router.get('/lft-posts', async (req, res) => {
  try {
    const {
      game,
      region,
      role,
      limit: rawLimit = '20',
      page: rawPage = '1',
      status = 'active' // default to active posts
    } = req.query;

    // sanitize & caps
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 50); // 1..50
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = (page - 1) * limit;

    // Build filter
    const match = {};
    if (status) match.status = status;
    if (game) match.game = game;
    if (region) match.region = region;
    if (role) {
      // roles is an array in the document — match any post where roles contains the role
      match.roles = { $in: [role] };
    }

    // Aggregation: match -> lookup player (small) -> project -> facet (results + total)
    // Use $sample to randomize the order so users don't all see the same post first.
    const agg = [
      { $match: match },

      {
        $lookup: {
          from: 'players',                 // collection name, ensure this matches
          localField: 'player',
          foreignField: '_id',
          as: 'player'
        }
      },
      { $unwind: { path: '$player', preserveNullAndEmptyArrays: true } },

      {
        $project: {
          description: 1,
          game: 1,
          roles: 1,
          region: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          // minimal player object
          'player._id': 1,
          'player.username': 1,
          'player.realName': 1,
          'player.profilePicture': 1,
          'player.age': 1,
          'player.aegisRating': 1,
          'player.verified': 1
        }
      },

      {
        $facet: {
          // Randomize results so different users see different posts at the top
          paginatedResults: [
            { $sample: { size: limit * page } },  // random pool
            { $skip: skip },
            { $limit: limit },
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [result] = await LFTPost.aggregate(agg).exec();
    const posts = (result && result.paginatedResults) || [];
    const total = (result && result.totalCount[0] && result.totalCount[0].count) || 0;

    res.json({
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalItems: total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching LFT posts:', error);
    res.status(500).json({ error: 'Failed to fetch LFT posts' });
  }
});


const MAX_DESC_LEN = 1000; // Updated to match lftPost.model.js
const MAX_ROLES = 5;
const ALLOWED_GAMES = ['BGMI', 'VALORANT'];
const ALLOWED_REGIONS = ['India', 'Asia', 'Europe', 'North America', 'Global'];
const ALLOWED_ROLES = ['IGL', 'Assaulter', 'Support', 'Sniper', 'Fragger', 'Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];

const normalizeRegion = (input, fallback = 'India') => {
  const raw = String(input || '').trim();
  if (!raw) return fallback;

  if (ALLOWED_REGIONS.includes(raw)) return raw;

  const value = raw.toLowerCase();
  if (value === 'india' || value === 'in') return 'India';
  if (value === 'asia' || value === 'sea' || value === 'apac') return 'Asia';
  if (value === 'europe' || value === 'eu' || value === 'emea') return 'Europe';
  if (
    value === 'north america' || value === 'na' || value === 'usa' || value === 'us' || value === 'canada'
  ) {
    return 'North America';
  }
  if (value === 'global' || value === 'world' || value === 'international') return 'Global';

  return fallback;
};

router.post('/lft-posts', auth, async (req, res) => {
  const session = await mongoose.startSession().catch(() => null);
  try {
    const { description = '', roles = [], game = 'BGMI' } = req.body || {};

    // Basic validation + sanitization
    const desc = String(description).trim().slice(0, MAX_DESC_LEN);

    // Validate roles: ensure array of short strings and cap
    let cleanRoles = [];
    if (Array.isArray(roles)) {
      cleanRoles = roles
        .map(r => String(r).trim())
        .filter(r => ALLOWED_ROLES.includes(r))
        .slice(0, MAX_ROLES);
    }

    if (Array.isArray(roles) && roles.length > 0 && cleanRoles.length === 0) {
      return res.status(400).json({ error: 'No valid roles provided' });
    }

    // Validation matching model requirements
    if (cleanRoles.length === 0) {
      return res.status(400).json({ error: 'At least one role is required' });
    }
    if (!desc) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!ALLOWED_GAMES.includes(game)) {
      return res.status(400).json({ error: 'Invalid game' });
    }

    // Optional: check player exists (should always, but defensive)
    const player = await Player.findById(req.user.id).select('_id username profilePicture aegisRating verified team teamStatus country');
    if (!player) {
      return res.status(400).json({ error: 'Player profile not found' });
    }

    const hasTeamRef = Boolean(player.team);
    const isMarkedInTeam = String(player.teamStatus || '').toLowerCase() === 'in a team';
    if (hasTeamRef || isMarkedInTeam) {
      return res.status(400).json({
        error: 'You are already in a team. Leave your current team before posting LFT.'
      });
    }

    // Region is always derived server-side to avoid client-side invalid values.
    const postRegion = normalizeRegion(player.country, 'India');

    // Prevent duplicates - prefer DB unique partial index but attempt transactional guard
    // If you don't have replica set, session may be null, fall back to simpler check + error handling
    let createdPost;
    if (session) {
      session.startTransaction();
      const exists = await LFTPost.findOne({ player: req.user.id, status: 'active' }).session(session);
      if (exists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'You already have an active LFT post' });
      }

      createdPost = await LFTPost.create([{
        player: req.user.id,
        description: desc,
        game: game,
        roles: cleanRoles,
        region: postRegion,
        status: 'active',
      }], { session });

      await session.commitTransaction();
      session.endSession();
      createdPost = createdPost[0];
    } else {
      // No transaction available (standalone mongod). Do a cautious approach and handle duplicate key error.
      const exists = await LFTPost.findOne({ player: req.user.id, status: 'active' });
      if (exists) return res.status(400).json({ error: 'You already have an active LFT post' });

      createdPost = new LFTPost({
        player: req.user.id,
        description: desc,
        game: game,
        roles: cleanRoles,
        region: postRegion,
        status: 'active',
      });

      try {
        await createdPost.save();
      } catch (err) {
        // If you later add a unique partial index and two concurrent saved happened, handle duplicate key
        if (err && err.code === 11000) {
          return res.status(400).json({ error: 'You already have an active LFT post' });
        }
        throw err;
      }
    }

    // Populate a few safe fields for the client
    await createdPost.populate('player', 'username profilePicture aegisRating verified');

    res.status(201).json({ message: 'LFT post created successfully', post: createdPost });
  } catch (error) {
    console.error('Error creating LFT post:', error);
    // generic message to client, detailed log on server
    res.status(500).json({ error: 'Failed to create LFT post' });
  }
});

// GET My active LFT post
router.get('/lft-posts/mine', auth, async (req, res) => {
  try {
    const post = await LFTPost.findOne({
      player: req.user.id,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .populate('player', 'username profilePicture aegisRating verified realName age inGameName');

    res.json({ post: post || null });
  } catch (error) {
    console.error('Error fetching my LFT post:', error);
    res.status(500).json({ error: 'Failed to fetch your LFT post' });
  }
});

// PATCH LFT Post - Update own active LFT post
router.patch('/lft-posts/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { description, roles } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await LFTPost.findOne({
      _id: postId,
      player: req.user.id,
      status: 'active',
    });

    if (!post) {
      return res.status(404).json({ error: 'Active LFT post not found' });
    }

    if (description != null) {
      const desc = String(description).trim().slice(0, MAX_DESC_LEN);
      if (!desc) {
        return res.status(400).json({ error: 'Description is required' });
      }
      post.description = desc;
    }

    if (roles != null) {
      if (!Array.isArray(roles)) {
        return res.status(400).json({ error: 'Roles must be an array' });
      }

      const cleanRoles = roles
        .map(r => String(r).trim())
        .filter(r => ALLOWED_ROLES.includes(r))
        .slice(0, MAX_ROLES);

      if (cleanRoles.length === 0) {
        return res.status(400).json({ error: 'At least one role is required' });
      }

      post.roles = cleanRoles;
    }

    await post.save();
    await post.populate('player', 'username profilePicture aegisRating verified realName age inGameName');

    res.json({ message: 'LFT post updated successfully', post });
  } catch (error) {
    console.error('Error updating LFT post:', error);
    res.status(500).json({ error: 'Failed to update LFT post' });
  }
});

// DELETE LFT Post - Delete own LFT post
router.delete('/lft-posts/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await LFTPost.findOneAndDelete({
      _id: postId,
      player: req.user.id,
    });

    if (!post) {
      return res.status(404).json({ error: 'LFT post not found' });
    }

    res.json({ message: 'LFT post deleted successfully' });
  } catch (error) {
    console.error('Error deleting LFT post:', error);
    res.status(500).json({ error: 'Failed to delete LFT post' });
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
      }
    });

    await tryoutChat.save();
    await createTryoutMessage({
      chatId: tryoutChat._id,
      sender: 'system',
      message: `${approach.player.username} has accepted the recruitment approach from ${team.teamName}. All team members can now discuss opportunities.`,
      messageType: 'system',
      timestamp: new Date(),
    });

    // Link tryout chat back to approach
    approach.tryoutChatId = tryoutChat._id;
    await approach.save();

    await ChatMessage.updateOne(
      { 'metadata.approachId': new mongoose.Types.ObjectId(approachId) },
      { $set: { 'metadata.approachStatus': 'accepted' } }
    );

    await tryoutChat.populate('team applicant participants');
    const hydratedTryoutChat = {
      ...tryoutChat.toObject(),
      messages: await fetchTryoutMessages(tryoutChat._id),
    };

    const captainId = team?.captain?._id?.toString() || team?.captain?.toString();
    if (captainId) {
      notificationService
        .sendToPlayer(
          captainId,
          'Tryout Chat Created',
          `${approach.player.username} accepted your approach. Tryout chat is now active.`,
          {
            type: 'tryout_started',
            chatId: String(tryoutChat._id),
            approachId: String(approach._id),
            playerId: String(approach.player._id),
            playerName: approach.player.username,
          }
        )
        .catch((err) => {
          console.error('Approach accept notification error:', err);
        });
    }

    res.json({
      message: 'Approach accepted and tryout chat created',
      tryoutChat: hydratedTryoutChat
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
      { 'metadata.approachId': new mongoose.Types.ObjectId(approachId) },
      { $set: { 'metadata.approachStatus': 'rejected' } }
    );

    await approach.populate('team', 'captain teamName').populate('player', 'username');

    const captainId = approach?.team?.captain?.toString();
    if (captainId) {
      notificationService
        .sendToPlayer(
          captainId,
          'Approach Rejected',
          `${approach.player?.username || 'The player'} declined your recruitment approach.`,
          {
            type: 'approach_rejected',
            approachId: String(approach._id),
            playerId: String(approach.player?._id || ''),
            teamId: String(approach.team?._id || ''),
            teamName: approach.team?.teamName,
            directUserId: 'system',
          }
        )
        .catch((err) => {
          console.error('Approach reject notification error:', err);
        });
    }

    res.json({ message: 'Approach rejected' });
  } catch (error) {
    console.error('Error rejecting approach:', error);
    res.status(500).json({ error: 'Failed to reject approach' });
  }
});

// ==========================================
// LFP (Looking For Players) POST ROUTES
// ==========================================

const MAX_LFP_DESC_LEN = 1000;
const MAX_OPEN_ROLES = 5;

const parseLfpListQuery = (query = {}) => {
  const {
    game,
    region,
    role,
    limit: rawLimit = '20',
    page: rawPage = '1',
    status = 'active'
  } = query;

  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(rawPage, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const match = {};
  if (status) match.status = status;
  if (game) match.game = game;
  if (region) match.region = region;
  if (role) {
    match.openRoles = { $in: [role] };
  }

  return { match, limit, page, skip };
};

const buildLfpListAggregation = ({ match, skip, limit }) => {
  return [
    { $match: match },
    {
      $lookup: {
        from: 'teams',
        localField: 'team',
        foreignField: '_id',
        as: 'team'
      }
    },
    { $unwind: '$team' },
    {
      $lookup: {
        from: 'players',
        localField: 'team.captain',
        foreignField: '_id',
        as: 'captain'
      }
    },
    { $unwind: { path: '$captain', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        description: 1,
        game: 1,
        openRoles: 1,
        region: 1,
        status: 1,
        createdAt: 1,
        'team._id': 1,
        'team.teamName': 1,
        'team.teamTag': 1,
        'team.logo': 1,
        'team.primaryGame': 1,
        'team.region': 1,
        'captain._id': 1,
        'captain.username': 1,
        'captain.profilePicture': 1
      }
    },
    {
      $facet: {
        // Randomize results so different users see different posts at the top
        posts: [{ $sample: { size: limit * 3 } }, { $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }]
      }
    }
  ];
};

// GET LFP Posts - Fetch all active LFP posts with filters
router.get('/lfp-posts', async (req, res) => {
  try {
    const { match, limit, page, skip } = parseLfpListQuery(req.query);

    const agg = buildLfpListAggregation({ match, skip, limit });

    const [result] = await LFPPost.aggregate(agg).exec();
    const posts = result.posts || [];
    const totalCount = result.totalCount.length > 0 ? result.totalCount[0].count : 0;

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching LFP posts:', error);
    res.status(500).json({ error: 'Failed to fetch LFP posts' });
  }
});

// GET LFP Discovery Feed - personalized for swipe UI (auth required)
router.get('/lfp-posts/discover', auth, async (req, res) => {
  try {
    const { match, limit, page, skip } = parseLfpListQuery(req.query);

    const [swipes, player] = await Promise.all([
      LFPSwipe.find({ player: req.user.id }).select('post').lean(),
      Player.findById(req.user.id).select('team').lean(),
    ]);

    const seenPostIds = swipes
      .map((item) => item.post)
      .filter((item) => mongoose.Types.ObjectId.isValid(item));

    if (seenPostIds.length > 0) {
      match._id = { $nin: seenPostIds };
    }

    if (player?.team && mongoose.Types.ObjectId.isValid(player.team)) {
      match.team = { $ne: player.team };
    }

    const agg = buildLfpListAggregation({ match, skip, limit });

    const [result] = await LFPPost.aggregate(agg).exec();
    const posts = result.posts || [];
    const totalCount = result.totalCount.length > 0 ? result.totalCount[0].count : 0;

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching LFP discovery feed:', error);
    res.status(500).json({ error: 'Failed to fetch LFP discovery feed' });
  }
});

router.post('/lfp-posts/:postId/swipe', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const action = String(req.body?.action || '').trim().toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    if (action !== 'left' && action !== 'right') {
      return res.status(400).json({ error: 'Action must be either left or right' });
    }

    const post = await LFPPost.findById(postId).select('_id team status').lean();
    if (!post || post.status !== 'active') {
      return res.status(404).json({ error: 'LFP post not found or inactive' });
    }

    await LFPSwipe.findOneAndUpdate(
      { player: req.user.id, post: post._id },
      {
        player: req.user.id,
        post: post._id,
        team: post.team,
        action,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Swipe saved', action });
  } catch (error) {
    console.error('Error saving LFP swipe:', error);
    res.status(500).json({ error: 'Failed to save swipe action' });
  }
});

router.delete('/lfp-posts/:postId/swipe', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    await LFPSwipe.deleteOne({ player: req.user.id, post: postId });
    res.json({ message: 'Swipe removed' });
  } catch (error) {
    console.error('Error removing LFP swipe:', error);
    res.status(500).json({ error: 'Failed to remove swipe action' });
  }
});

// POST LFP Post - Create new LFP post (Captain only)
router.post('/lfp-posts', auth, async (req, res) => {
  const session = await mongoose.startSession().catch(() => null);
  try {
    const { description = '', game, openRoles = [] } = req.body || {};

    // Sanitize input
    const desc = String(description).trim().slice(0, MAX_LFP_DESC_LEN);

    // Get player and team
    const player = await Player.findById(req.user.id).populate('team');
    if (!player) {
      return res.status(400).json({ error: 'Player profile not found' });
    }

    if (!player.team) {
      return res.status(400).json({ error: 'You must be in a team to post LFP' });
    }

    // Verify player is captain
    if (player.team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captains can post LFP' });
    }

    // Determine game and region
    const postGame = game || player.team.primaryGame;
    const postRegion = normalizeRegion(player.team.region, 'India');

    // Validate inputs
    if (!desc) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!postGame) {
      return res.status(400).json({ error: 'Game is required' });
    }
    if (!ALLOWED_GAMES.includes(postGame)) {
      return res.status(400).json({ error: 'Invalid game' });
    }

    // Validate roles
    let cleanRoles = [];
    if (Array.isArray(openRoles)) {
      cleanRoles = openRoles
        .map(r => String(r).trim())
        .filter(r => ALLOWED_ROLES.includes(r))
        .slice(0, MAX_OPEN_ROLES);
    }

    if (Array.isArray(openRoles) && openRoles.length > 0 && cleanRoles.length === 0) {
      return res.status(400).json({ error: 'No valid roles provided' });
    }

    if (cleanRoles.length === 0) {
      return res.status(400).json({ error: 'At least one open role is required' });
    }

    // Check for existing active LFP post
    let createdPost;
    if (session) {
      session.startTransaction();
      const exists = await LFPPost.findOne({ team: player.team._id, status: 'active' }).session(session);
      if (exists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Your team already has an active LFP post' });
      }

      createdPost = await LFPPost.create([{
        team: player.team._id,
        description: desc,
        game: postGame,
        openRoles: cleanRoles,
        region: postRegion,
        status: 'active',
      }], { session });

      await session.commitTransaction();
      session.endSession();
      createdPost = createdPost[0];
    } else {
      const exists = await LFPPost.findOne({ team: player.team._id, status: 'active' });
      if (exists) return res.status(400).json({ error: 'Your team already has an active LFP post' });

      createdPost = new LFPPost({
        team: player.team._id,
        description: desc,
        game: postGame,
        openRoles: cleanRoles,
        region: postRegion,
        status: 'active',
      });

      try {
        await createdPost.save();
      } catch (err) {
        if (err && err.code === 11000) {
          return res.status(400).json({ error: 'Your team already has an active LFP post' });
        }
        throw err;
      }
    }

    await createdPost.populate({
      path: 'team',
      populate: { path: 'captain', select: 'username profilePicture' }
    });

    res.status(201).json({ message: 'LFP post created successfully', post: createdPost });
  } catch (error) {
    console.error('Error creating LFP post:', error);
    res.status(500).json({ error: 'Failed to create LFP post' });
  }
});

// DELETE LFP Post - Delete own team's LFP post
router.delete('/lfp-posts/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const player = await Player.findById(req.user.id).populate('team');
    if (!player || !player.team) {
      return res.status(400).json({ error: 'Player or team not found' });
    }

    // Verify player is captain
    if (player.team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only team captains can delete LFP posts' });
    }

    const post = await LFPPost.findOneAndDelete({
      _id: postId,
      team: player.team._id
    });

    if (!post) {
      return res.status(404).json({ error: 'LFP post not found' });
    }

    res.json({ message: 'LFP post deleted successfully' });
  } catch (error) {
    console.error('Error deleting LFP post:', error);
    res.status(500).json({ error: 'Failed to delete LFP post' });
  }
});

export default router;