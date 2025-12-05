import express from 'express';
import Team from '../models/team.model.js';
import TeamInvitation from '../models/teamInvitation.model.js';
import Match from '../models/match.model.js';
import Tournament from '../models/tournament.model.js';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/:id', auth, async (req, res) => {
  try {
    const teamId = req.params.id.trim();
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

    if (team.profileVisibility === 'private') {
      // Allow access if user is captain or player in the team
      if (!team.players.includes(req.user.id) && team.captain.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: 'This team profile is private' });
      }
    }

    // Fetch recent matches
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

    // Fetch tournaments the team has participated in
    const tournaments = await Tournament.find({
      'participatingTeams.team': team._id
    })
      .sort({ startDate: -1 })
      .limit(10)
      .select('tournamentName shortName startDate endDate status prizePool media tier')
      .lean();

    // Separate ongoing and past tournaments
    const now = new Date();
    const ongoingTournaments = tournaments.filter(t =>
      t.status !== 'completed' && t.status !== 'cancelled' && t.endDate >= now
    );
    const recentTournaments = tournaments.filter(t =>
      t.status === 'completed' || t.endDate < now
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

// POST /api/teams - Create a new team
router.post('/', auth, async (req, res) => {
  try {
    const {
      teamName,
      teamTag,
      primaryGame,
      region,
      bio,
      logo
    } = req.body;

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

    const existingCaptaincy = await Team.findOne({ captain: req.user.id });
    if (existingCaptaincy) {
      return res.status(400).json({ message: 'You are already a captain of another team' });
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
    const invitation = await TeamInvitation.findById(req.params.id)
      .populate('team');

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
      return res.status(400).json({ message: 'Invitation has expired' });
    }

    const player = await Player.findById(req.user.id);
    if (player.team) {
      return res.status(400).json({ message: 'You are already in a team' });
    }

    const team = await Team.findById(invitation.team._id);
    if (team.players.length >= 5) {
      return res.status(400).json({ message: 'Team is already full' });
    }

    // Add player to team
    team.players.push(req.user.id);
    await team.save();

    // Update player
    await Player.findByIdAndUpdate(req.user.id, {
      team: team._id,
      teamStatus: 'in a team'
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
      team
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

    team.players = team.players.filter(p => p.toString() !== playerId);
    await team.save();

    await Player.findByIdAndUpdate(playerId, {
      $unset: { team: 1 },
      teamStatus: 'looking for a team',
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

export default router;