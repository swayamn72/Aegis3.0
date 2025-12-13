import express from 'express';
import Team from '../models/team.model.js';
import TeamInvitation from '../models/teamInvitation.model.js';
import Match from '../models/match.model.js';
import Tournament from '../models/tournament.model.js';
import Player from '../models/player.model.js';
import ChatMessage from '../models/chat.model.js';
import Organization from '../models/organization.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import auth from '../middleware/auth.js';
import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';
import mongoose from 'mongoose';


const router = express.Router();

// ============================================================================
// GET TEAM DETAILS WITH MATCHES AND TOURNAMENTS
// ============================================================================

router.get('/:id', auth, async (req, res) => {
  try {
    const teamId = req.params.id.trim();
    
    // Get team details
    const team = await Team.findById(teamId)
      .populate({
        path: 'captain',
        select: 'username profilePicture primaryGame inGameName realName age country aegisRating statistics inGameRole discordTag twitch youtube twitter verified'
      })
      .populate({
        path: 'players',
        select: 'username profilePicture primaryGame inGameName realName age country aegisRating statistics inGameRole discordTag verified'
      })
      .populate('organization', 'orgName logo description website establishedDate')
      .select('-__v');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check privacy
    if (team.profileVisibility === 'private') {
      if (!team.players.includes(req.user.id) && team.captain.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: 'This team profile is private' });
      }
    }

    // Fetch recent matches (same as before - Match model unchanged)
    const recentMatches = await Match.find({
      'participatingTeams.team': team._id,
      status: 'completed'
    })
      .sort({ actualEndTime: -1 })
      .limit(5)
      .populate('tournament', 'tournamentName shortName')
      .select('matchNumber matchType map actualEndTime participatingTeams tournament')
      .lean();

    // Format match data
    const formattedMatches = recentMatches.map(match => {
      const teamData = match.participatingTeams.find(
        pt => pt.team.toString() === team._id.toString()
      );
      return {
        _id: match._id,
        matchNumber: match.matchNumber,
        matchType: match.matchType,
        map: match.map,
        date: match.actualEndTime,
        tournament: match.tournament,
        position: teamData?.finalPosition || null,
        kills: teamData?.kills?.total || 0,
        points: teamData?.points?.totalPoints || 0,
        chickenDinner: teamData?.chickenDinner || false
      };
    });

    // NEW: Get tournaments from Registration collection instead
    const registrations = await Registration.find({
      team: team._id,
      status: { $in: ['approved', 'checked_in'] }
    })
      .populate({
        path: 'tournament',
        select: 'tournamentName shortName startDate endDate status prizePool media tier'
      })
      .sort({ registeredAt: -1 })
      .limit(10)
      .lean();

    const tournaments = registrations
      .filter(r => r.tournament) // Filter out null tournaments
      .map(r => r.tournament);

    // Separate ongoing and past tournaments
    const now = new Date();
    const ongoingTournaments = tournaments.filter(t =>
      t.status !== 'completed' && t.status !== 'cancelled' && new Date(t.endDate) >= now
    );
    const recentTournaments = tournaments.filter(t =>
      t.status === 'completed' || new Date(t.endDate) < now
    ).slice(0, 5);

    res.json({
      team,
      recentMatches: formattedMatches,
      ongoingTournaments,
      recentTournaments
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ message: 'Server error fetching team' });
  }
});

// GET /api/teams/invitations/received - Get received team invitations
router.get('/invitations/received', auth, async (req, res) => {
  try {
    const invitations = await TeamInvitation.find({
      toPlayer: req.user.id,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .populate('team', 'teamName teamTag logo primaryGame region players')
      .populate('fromPlayer', 'username profilePicture')
      .sort({ createdAt: -1 });

    res.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: 'Server error fetching invitations' });
  }
});

// GET /api/teams/user/my-teams - Fetch teams the current user is part of
router.get('/user/my-teams', auth, async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { captain: req.user.id },
        { players: req.user.id }
      ]
    })
      .populate('captain', 'username profilePicture primaryGame')
      .populate('players', 'username profilePicture primaryGame')
      .populate('organization', 'orgName logo')
      .sort({ establishedDate: -1 })
      .select('-__v');

    res.json({ teams });
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({ message: 'Server error fetching teams' });
  }
});

// POST /api/teams - Create a new team
router.post('/', auth, async (req, res) => {
  try {

    const { teamName, teamTag, primaryGame, region, bio, logo } = req.body;

    const existingTeamName = await Team.findOne({ teamName });
    if (existingTeamName) {
      return res.status(400).json({ message: 'Team name already exists' });
    }

    if (teamTag) {
      const existingTeamTag = await Team.findOne({ teamTag: teamTag.toUpperCase() });
      if (existingTeamTag) {
        return res.status(400).json({ message: 'Team tag already exists' });
      }
    }

    const player = await Player.findById(req.user.id);

    if (!player) {
      return res.status(400).json({ message: 'Player profile not found' });
    }
    if (player.team) {
      return res.status(400).json({ message: 'You are already in a team' });
    }

    const newTeam = new Team({

      teamName,
      teamTag: teamTag ? teamTag.toUpperCase() : undefined,
      primaryGame: primaryGame || 'BGMI',
      region: region || 'India',
      bio,
      logo,
      captain: req.user.id,
      players: [req.user.id]
    });

    await newTeam.save();

    await Player.findByIdAndUpdate(req.user.id, {
      team: newTeam._id,
      teamStatus: 'in a team'
    });

    await newTeam.populate('captain', 'username profilePicture primaryGame');
    await newTeam.populate('players', 'username profilePicture primaryGame');

    res.status(201).json({
      message: 'Team created successfully',
      team: newTeam
    });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Team name or tag already exists' });
    }
    res.status(500).json({ message: 'Server error creating team' });
  }
});

// POST /api/teams/invitations/:id/accept - Accept team invitation
router.post('/invitations/:id/accept', auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid invitation ID' });
    }

    const invitation = await TeamInvitation.findById(id);

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.toPlayer.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'This invitation is not for you' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation is no longer valid' });
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = 'cancelled';
      await invitation.save();

      await ChatMessage.updateMany(
        { invitationId: invitation._id },
        { $set: { invitationStatus: 'cancelled' } }
      );

      return res.status(400).json({ message: 'Invitation has expired' });
    }

    const player = await Player.findById(req.user.id);

    if (!player) {
      return res.status(400).json({ message: 'Player profile not found' });
    }

    if (player.team) {
      return res.status(400).json({ message: 'You are already in a team' });
    }

    const team = await Team.findById(invitation.team); // ✅ FIXED

    if (!team) {
      return res.status(400).json({ message: 'Team no longer exists' });
    }

    if (team.players.length >= 5) {
      return res.status(400).json({ message: 'Team is already full' });
    }

    // Add player to team
    team.players.push(req.user.id);
    await team.save();

    // Update player
    await Player.findByIdAndUpdate(req.user.id, {
      team: team._id,
      teamStatus: 'in a team',
    });

    // Update invitation status
    invitation.status = 'accepted';
    await invitation.save();

    // Update related chat message invitationStatus
    await ChatMessage.updateMany(
      { invitationId: invitation._id },
      { $set: { invitationStatus: 'accepted' } }
    );

    res.json({
      message: 'Team invitation accepted successfully',
      team,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ message: 'Server error accepting invitation' });
  }
});

// POST /api/teams/invitations/:id/decline - Decline team invitation
router.post('/invitations/:id/decline', auth, async (req, res) => {
  try {
    const invitation = await TeamInvitation.findById(req.params.id);

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.toPlayer.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'This invitation is not for you' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation is no longer valid' });
    }
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'cancelled';
      await invitation.save();

      await ChatMessage.updateMany(
        { invitationId: invitation._id },
        { $set: { invitationStatus: 'cancelled' } }
      );

      return res.status(400).json({ message: 'Invitation has expired' });
    }


    invitation.status = 'declined';
    await invitation.save();

    // Update related chat message invitationStatus
    await ChatMessage.updateMany(
      { invitationId: invitation._id },
      { $set: { invitationStatus: 'declined' } }
    );

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ message: 'Server error declining invitation' });
  }
});

// DELETE /api/teams/:id/players/:playerId - Remove player from team
router.delete('/:id/players/:playerId', auth, async (req, res) => {
  try {
    const { id: teamId, playerId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const isCapt = team.captain.toString() === req.user.id.toString();
    const isSelf = playerId === req.user.id.toString();

    if (!isCapt && !isSelf) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    if (playerId === team.captain.toString()) {
      return res.status(400).json({ message: 'Cannot remove team captain. Transfer captaincy first.' });
    }

    const isMember = team.players.some(p => p.toString() === playerId);
    if (!isMember) {
      return res.status(400).json({ message: 'Player is not in this team' });
    }

    const playerDoc = await Player.findById(playerId);
    if (!playerDoc) {
      return res.status(404).json({ message: 'Player not found' });
    }

    team.players = team.players.filter(p => p.toString() !== playerId);
    await team.save();

    await Player.findByIdAndUpdate(playerId, {
      $unset: { team: "" },
      $set: { teamStatus: 'looking for a team' },
      $push: {
        previousTeams: {
          team: teamId,
          endDate: new Date(),
          reason: isSelf ? 'left' : 'removed'
        }
      }
    });

    res.json({ message: 'Player removed from team successfully' });
  } catch (error) {
    console.error('Error removing player:', error);
    res.status(500).json({ message: 'Server error removing player' });
  }
});

// PUT /api/teams/:id - Update team
router.put('/:id', auth, upload.single('logo'), async (req, res) => {
  try {
    const teamId = req.params.id;

    // 1. Load team and check captain permission
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Only team captain can update team details' });
    }

    const updateData = {};

    // 2. Handle logo upload (if file exists)
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'aegis-team-logos',
            public_id: `team-logo-${teamId}-${Date.now()}`,
            transformation: [{ width: 300, height: 300, crop: 'fill' }]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      updateData.logo = result.secure_url;
    }

    // 3. Parse body data correctly (supports multipart + JSON)
    let bodyData = {};

    // If client sends a "data" field with JSON (common pattern for multipart)
    if (req.body && req.body.data) {
      try {
        bodyData = JSON.parse(req.body.data);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON in data field' });
      }
    } else if (req.body) {
      // Normal form-data / json body with individual fields
      bodyData = req.body;
    }

    // Normalize teamTag like in create route
    if (bodyData.teamTag) {
      bodyData.teamTag = bodyData.teamTag.toUpperCase();
    }

    // 4. Whitelist fields that are allowed to be updated
    const allowedFields = [
      'teamName',
      'teamTag',
      'primaryGame',
      'region',
      'bio',
      'status',         // if you have status (active/disbanded/etc.)
      'socials',        // if you allow editing socials
      'profileVisibility' // only if you want captain to control this
      // add more explicitly allowed fields here as needed
    ];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(bodyData, field)) {
        updateData[field] = bodyData[field];
      }
    }

    // 5. If nothing to update, return 400
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }

    // 6. Apply update and return populated team
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('captain', 'username profilePicture primaryGame')
      .populate('players', 'username profilePicture primaryGame')
      .populate('organization', 'orgName logo');

    res.json({
      message: 'Team updated successfully',
      team: updatedTeam
    });
  } catch (error) {
    console.error('Error updating team:', error);

    // Duplicate key error (unique teamName/teamTag)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Team name or tag already exists' });
    }

    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error updating team' });
  }
});


// GET /api/teams/search/:query - Search teams and players
router.get('/search/:query', async (req, res) => {
  try {
    let { query } = req.params;
    let { game, region, limit = 20, searchType = 'all' } = req.query;

    // -------------------------------
    // 1. Normalize & validate input
    // -------------------------------
    query = (query || '').trim();
    searchType = String(searchType).toLowerCase();

    // Block empty & 1-char queries (prevents DB spam)
    if (!query || query.length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters'
      });
    }

    // Sanitize limit
    limit = parseInt(limit, 10);
    if (Number.isNaN(limit) || limit <= 0 || limit > 50) {
      limit = 20;
    }

    // Always return same shape (client-friendly)
    const results = {
      teams: [],
      players: []
    };

    // -------------------------------
    // 2. Search Teams
    // -------------------------------
    if (searchType === 'all' || searchType === 'teams') {
      const teamFilter = {
        profileVisibility: 'public',
        status: 'active',
        $or: [
          { teamName: { $regex: query, $options: 'i' } },
          { teamTag: { $regex: query, $options: 'i' } }
        ]
      };

      if (game) teamFilter.primaryGame = game;
      if (region) teamFilter.region = region;

      results.teams = await Team.find(teamFilter)
        .populate('captain', 'username profilePicture primaryGame') // ✅ keep only captain
        .sort({ aegisRating: -1 })
        .limit(limit)
        .select(
          'teamName teamTag logo primaryGame region aegisRating captain players establishedDate'
        )
        .lean();
    }

    // -------------------------------
    // 3. Search Players
    // -------------------------------
    if (searchType === 'all' || searchType === 'players') {
      const playerFilter = {
        profileVisibility: 'public',
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { inGameName: { $regex: query, $options: 'i' } },
          { realName: { $regex: query, $options: 'i' } }
        ]
      };

      if (game) playerFilter.primaryGame = game;

      results.players = await Player.find(playerFilter)
        .populate('team', 'teamName teamTag')
        .sort({ aegisRating: -1 })
        .limit(limit)
        .select(
          'username inGameName realName profilePicture primaryGame aegisRating teamStatus team'
        )
        .lean();
    }

    // -------------------------------
    // 4. Return results
    // -------------------------------
    res.json(results);
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ message: 'Server error searching' });
  }
});


// POST /api/teams/:id/invite - Send team invitation
router.post('/:id/invite', auth, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { playerId, message } = req.body;

    // Basic input validation
    if (!playerId) {
      return res.status(400).json({ message: 'playerId is required' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Only captain can invite
    if (!team.captain || !req.user?.id) {
      return res.status(400).json({ message: 'Invalid team captain or user ID' });
    }

    if (team.captain.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Only team captain can invite players' });
    }

    // Prevent inviting yourself
    if (playerId === req.user.id.toString()) {
      return res.status(400).json({ message: 'You cannot invite yourself' });
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // If your business rule is 1 team per player, this is correct
    if (player.team) {
      return res.status(400).json({ message: 'Player is already in a team' });
    }

    // Extra safety: if somehow player is already in this team
    const alreadyInTeam = team.players.some(p => p.toString() === playerId);
    if (alreadyInTeam) {
      return res.status(400).json({ message: 'Player is already in this team' });
    }

    // Hard cap on size
    if (team.players.length >= 5) {
      return res.status(400).json({ message: 'Team is already full (max 5 players)' });
    }

    // Check for existing pending invitation from this team to this player
    const existingInvitation = await TeamInvitation.findOne({
      team: team._id,
      toPlayer: playerId,
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({ message: 'Invitation already sent to this player' });
    }

    const defaultText = `You have been invited to join the team ${team.teamName || 'this team'}.`;

    const invitation = new TeamInvitation({
      team: team._id,
      fromPlayer: req.user.id,
      toPlayer: playerId,
      message: message || `Join ${team.teamName || 'our team'}!`
    });

    await invitation.save();

    // Create chat message for invitation
    const chatMessage = new ChatMessage({
      senderId: req.user.id,
      receiverId: playerId,
      message: message || defaultText,
      messageType: 'invitation',
      invitationId: invitation._id
    });

    await chatMessage.save();
    console.log('Chat message created for team invitation:', chatMessage._id.toString());

    res.status(201).json({
      message: 'Team invitation sent successfully',
      invitation
    });
  } catch (error) {
    console.error('Error sending team invitation:', error);
    res.status(500).json({ message: 'Server error sending invitation' });
  }
});



export default router;

