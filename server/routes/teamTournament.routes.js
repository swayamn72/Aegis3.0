import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
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
// ============================================================================
// ACCEPT TOURNAMENT INVITATION (UPDATED)
// ============================================================================

router.post('/accept-invitation/:tournamentId/:invitationId', verifyTeamCaptain, async (req, res) => {
  try {
    const { tournamentId, invitationId } = req.params;

    // Get tournament
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // NEW: Get invitation from Invitation collection
    const invitation = await Invitation.findOne({
      _id: invitationId,
      tournament: tournamentId,
      team: req.team._id
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already processed' });
    }

    // Check if invitation is expired
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      await invitation.expire();
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // NEW: Check if tournament is full using Registration count
    const currentCount = await Registration.countDocuments({
      tournament: tournamentId,
      status: { $in: ['approved', 'checked_in'] }
    });

    if (currentCount >= tournament.slots.total) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    // NEW: Check if team already registered
    const existingRegistration = await Registration.findOne({
      tournament: tournamentId,
      team: req.team._id,
      status: { $in: ['pending', 'approved', 'checked_in'] }
    });

    if (existingRegistration) {
      return res.status(400).json({ error: 'Team already registered for this tournament' });
    }

    // NEW: Use the invitation's accept method (creates Registration automatically)
    await invitation.accept(req.user.id, 'Invitation accepted via API');

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

// ============================================================================
// REGISTER TEAM FOR OPEN TOURNAMENT (UPDATED)
// ============================================================================

router.post('/register/:tournamentId', verifyTeamCaptain, async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // Fetch tournament (minimal data needed)
    const tournament = await Tournament.findById(tournamentId)
      .select(`
        tournamentName status registrationEndDate slots gameTitle 
        phases organizer isOpenForAll
      `)
      .populate('organizer', 'orgName')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Verify tournament accepts open registrations
    if (tournament.status !== 'registration_open' && tournament.status !== 'announced') {
      return res.status(400).json({ error: 'Tournament registration is closed' });
    }

    // Check registration deadline
    const now = new Date();
    if (tournament.registrationEndDate && now > new Date(tournament.registrationEndDate)) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // NEW: Check current registration count
    const currentCount = await Registration.countDocuments({
      tournament: tournamentId,
      status: { $in: ['approved', 'checked_in', 'pending'] }
    });

    if (currentCount >= tournament.slots.total) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    // NEW: Check if team already registered
    const existingRegistration = await Registration.findOne({
      tournament: tournamentId,
      team: req.team._id
    });

    if (existingRegistration) {
      return res.status(400).json({ 
        error: 'Team already registered for this tournament',
        status: existingRegistration.status
      });
    }

    // Check team has minimum required members
    if (req.team.players.length < 4) {
      return res.status(400).json({
        error: 'Team must have at least 4 members to register for tournaments'
      });
    }

    // Check game compatibility
    if (tournament.gameTitle !== req.team.primaryGame) {
      return res.status(400).json({
        error: `Team primary game (${req.team.primaryGame}) does not match tournament game (${tournament.gameTitle})`
      });
    }

    // NEW: Create registration
    const firstPhase = tournament.phases && tournament.phases.length > 0 ? 
                      tournament.phases[0] : null;

    const registration = await Registration.create({
      tournament: tournamentId,
      team: req.team._id,
      status: tournament.isOpenForAll ? 'pending' : 'approved', // Auto-approve if open
      qualifiedThrough: 'open_registration',
      currentStage: firstPhase?.name || 'Registered',
      phase: firstPhase?.name,
      roster: req.team.players.map(playerId => ({
        player: playerId,
        // You can add role info if available in team model
      }))
    });

    // Send registration confirmation emails
    try {
      // Fetch player emails (only what's needed)
      const players = await Player.find({ 
        _id: { $in: req.team.players } 
      })
        .select('email username')
        .lean();

      const organizerName = tournament.organizer?.orgName || 'AEGIS Esports';

      for (const player of players) {
        if (player.email) {
          const { subject, html } = emailTemplates.tournamentRegistration(
            player.username,
            req.team.teamName,
            tournament.tournamentName
          );
          await sendEmail(player.email, subject, html);
        }
      }
    } catch (emailError) {
      console.error('Error sending tournament registration emails:', emailError);
      // Don't fail the request if emails fail
    }

    res.json({
      message: 'Team registered successfully',
      registration: {
        _id: registration._id,
        status: registration.status,
        registeredAt: registration.registeredAt
      },
      tournament: {
        _id: tournament._id,
        name: tournament.tournamentName
      }
    });
  } catch (error) {
    console.error('Error registering for tournament:', error);
    res.status(500).json({ error: 'Failed to register for tournament' });
  }
});

export default router;