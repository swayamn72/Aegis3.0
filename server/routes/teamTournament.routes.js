import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';

const router = express.Router();

// Middleware to verify team captain
const verifyTeamCaptain = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const player = await Player.findById(decoded.id).populate('team');
    if (!player || !player.team) {
      return res.status(403).json({ message: 'Player not in a team' });
    }

    // Check if player is team captain
    const team = player.team;
    if (team.captain.toString() !== player._id.toString()) {
      return res.status(403).json({ message: 'Only team captain can manage tournament invitations' });
    }

    req.player = player;
    req.team = team;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};
// Accept tournament invitation
router.post('/accept-invitation/:tournamentId/:invitationId', verifyTeamCaptain, async (req, res) => {
  try {
    const { tournamentId, invitationId } = req.params;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Find the invitation
    const invitationIndex = tournament._pendingInvitations.findIndex(
      inv => inv._id.toString() === invitationId && inv.team.toString() === req.team._id.toString()
    );

    if (invitationIndex === -1) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = tournament._pendingInvitations[invitationIndex];

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already processed' });
    }

    // Check if tournament is full
    if (tournament.participatingTeams.length >= tournament.slots.total) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    // Check if team already registered
    const alreadyRegistered = tournament.participatingTeams.some(
      pt => pt.team.toString() === req.team._id.toString()
    );

    if (alreadyRegistered) {
      return res.status(400).json({ error: 'Team already registered for this tournament' });
    }

    // Add team to tournament
    tournament.participatingTeams.push({
      team: req.team._id,
      qualifiedThrough: 'invite',
      currentStage: invitation.phase || 'Registered',
      totalTournamentPoints: 0,
      totalTournamentKills: 0
    });

    // Update invitation status
    tournament._pendingInvitations[invitationIndex].status = 'accepted';
    tournament._pendingInvitations[invitationIndex].acceptedAt = new Date();

    await tournament.save();

    res.json({
      message: 'Tournament invitation accepted successfully',
      tournament: {
        _id: tournament._id,
        name: tournament.tournamentName
      }
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Decline tournament invitation
router.post('/decline-invitation/:tournamentId/:invitationId', verifyTeamCaptain, async (req, res) => {
  try {
    const { tournamentId, invitationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
      return res.status(400).json({ error: 'Invalid invitation ID' });
    }

    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!Array.isArray(tournament._pendingInvitations)) {
      return res.status(400).json({ error: 'No pending invitations for this tournament' });
    }

    // Optional but sane
    if (['completed', 'cancelled'].includes(tournament.status)) {
      return res.status(400).json({ error: 'Cannot decline invitation for a completed or cancelled tournament' });
    }

    const invitationIndex = tournament._pendingInvitations.findIndex(
      inv =>
        inv._id.toString() === invitationId &&
        inv.team.toString() === req.team._id.toString()
    );

    if (invitationIndex === -1) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = tournament._pendingInvitations[invitationIndex];

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already processed' });
    }

    // Update invitation status
    tournament._pendingInvitations[invitationIndex].status = 'declined';
    tournament._pendingInvitations[invitationIndex].declinedAt = new Date();

    await tournament.save();

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

export default router;