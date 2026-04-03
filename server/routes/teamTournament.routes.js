import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import extractToken from '../utils/extractToken.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import { sendTournamentRegistrationEmail } from '../config/email.js';

const router = express.Router();

// Middleware to verify team captain
const verifyTeamCaptain = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
// CHECK TEAM REGISTRATION STATUS
// ============================================================================
router.get('/registration-status/:tournamentId/:teamId', async (req, res) => {
  try {
    const { tournamentId, teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tournamentId) || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ error: 'Invalid tournament or team ID' });
    }

    const registration = await Registration.findOne({
      tournament: tournamentId,
      team: teamId
    })
      .select('status qualifiedThrough currentStage phase group registeredAt approvedAt')
      .lean();

    if (!registration) {
      return res.status(404).json({ error: 'Team not registered for this tournament' });
    }

    res.json({
      registration: {
        _id: registration._id,
        status: registration.status,
        qualifiedThrough: registration.qualifiedThrough,
        currentStage: registration.currentStage,
        phase: registration.phase,
        group: registration.group,
        registeredAt: registration.registeredAt,
        approvedAt: registration.approvedAt
      }
    });
  } catch (error) {
    console.error('Error checking registration status:', error);
    res.status(500).json({ error: 'Failed to check registration status' });
  }
});

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
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;
    let responsePayload = null;
    let tournamentForEmail = null;
    let registrationForEmail = null;
    let organizerNameForEmail = 'AEGIS Esports';

    await session.withTransaction(async () => {
      // Fetch tournament (minimal data needed)
      const tournament = await Tournament.findById(tournamentId)
        .session(session)
        .select(`
        tournamentName status registrationEndDate slots gameTitle 
        phases organizer isOpenForAll requiresApproval
      `)
        .populate('organizer', 'orgName')
        .lean();

      if (!tournament) {
        throw new Error('TOURNAMENT_NOT_FOUND');
      }

      // Verify tournament accepts open registrations
      if (tournament.status !== 'registration_open' && tournament.status !== 'announced') {
        throw new Error('REGISTRATION_CLOSED');
      }

      // Check registration deadline
      const now = new Date();
      if (tournament.registrationEndDate && now > new Date(tournament.registrationEndDate)) {
        throw new Error('REGISTRATION_DEADLINE_PASSED');
      }

      // Check current registration count
      const currentCount = await Registration.countDocuments({
        tournament: tournamentId,
        status: { $in: ['approved', 'checked_in', 'pending'] }
      }).session(session);

      if (currentCount >= tournament.slots.total) {
        throw new Error('TOURNAMENT_FULL');
      }

      // Check if team already registered
      const existingRegistration = await Registration.findOne({
        tournament: tournamentId,
        team: req.team._id
      }).session(session).lean();

      if (existingRegistration) {
        const err = new Error('TEAM_ALREADY_REGISTERED');
        err.meta = { existingStatus: existingRegistration.status };
        throw err;
      }

      // Check team has minimum required members
      if (req.team.players.length < 4) {
        throw new Error('TEAM_TOO_SMALL');
      }

      // Check if all players have at least one game ID
      const playersWithoutGameIds = await Player.find({
        _id: { $in: req.team.players },
        $or: [
          { gameIds: { $exists: false } },
          { gameIds: { $size: 0 } }
        ]
      }).session(session).select('_id username').lean();

      if (playersWithoutGameIds.length > 0) {
        const err = new Error('PLAYERS_MISSING_GAME_ID');
        err.meta = { playersWithoutGameIds };
        throw err;
      }

      // Check game compatibility
      if (tournament.gameTitle !== req.team.primaryGame) {
        const err = new Error('GAME_MISMATCH');
        err.meta = { tournamentGame: tournament.gameTitle, teamGame: req.team.primaryGame };
        throw err;
      }

      // Fetch players with full game ID info for roster
      const playersWithGameIdsFull = await Player.find({
        _id: { $in: req.team.players }
      }).session(session).select('_id gameIds inGameRole').lean();

      // Phase assignment is intentionally deferred — the org calls
      // POST /:tournamentId/lock-registrations after registration closes,
      // which bulk-assigns all approved teams to phase 1 at once.
      // This prevents stale phase references if the org restructures phases
      // or renames them before the tournament begins.
      //
      // Auto-approval logic:
      //   isOpenForAll=false          → pending  (invite-only or closed, org reviews)
      //   isOpenForAll=true + requiresApproval=true  → pending  (org manually reviews each)
      //   isOpenForAll=true + requiresApproval=false → approved (first-come-first-served)
      const autoApprove = tournament.isOpenForAll && !tournament.requiresApproval;
      const registrations = await Registration.create([{
        tournament: tournamentId,
        team: req.team._id,
        status: autoApprove ? 'approved' : 'pending',
        qualifiedThrough: 'open_registration',
        currentStage: 'Registered',
        phase: null,
        approvedAt: autoApprove ? new Date() : undefined,
        roster: playersWithGameIdsFull.map(player => {
          const primaryGameId = player.gameIds?.find(gid => gid.isPrimary) || player.gameIds?.[0];
          return {
            player: player._id,
            inGameName: primaryGameId?.inGameName || 'Unknown'
          };
        })
      }], { session });

      const registration = registrations[0];
      tournamentForEmail = tournament;
      registrationForEmail = registration;
      organizerNameForEmail = tournament.organizer?.orgName || 'AEGIS Esports';

      responsePayload = {
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
      };
    });

    // Send registration confirmation emails
    try {
      // Fetch player emails (only what's needed)
      const players = await Player.find({
        _id: { $in: req.team.players }
      })
        .select('email username')
        .lean();

      const organizerName = organizerNameForEmail || 'AEGIS Esports';

      for (const player of players) {
        if (player.email) {
          await sendTournamentRegistrationEmail(
            player.email,
            player.username,
            req.team.teamName,
            tournamentForEmail?.tournamentName
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending tournament registration emails:', emailError);
      // Don't fail the request if emails fail
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Error registering for tournament:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (error.message === 'REGISTRATION_CLOSED') {
      return res.status(400).json({ error: 'Tournament registration is closed' });
    }
    if (error.message === 'REGISTRATION_DEADLINE_PASSED') {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }
    if (error.message === 'TOURNAMENT_FULL') {
      return res.status(400).json({ error: 'Tournament is full' });
    }
    if (error.message === 'TEAM_ALREADY_REGISTERED') {
      return res.status(400).json({
        error: 'Team already registered for this tournament',
        status: error.meta?.existingStatus
      });
    }
    if (error.message === 'TEAM_TOO_SMALL') {
      return res.status(400).json({
        error: 'Team must have at least 4 members to register for tournaments'
      });
    }
    if (error.message === 'PLAYERS_MISSING_GAME_ID') {
      const playersWithoutGameIds = error.meta?.playersWithoutGameIds || [];
      const playerNames = playersWithoutGameIds.map(p => p.username).join(', ');
      return res.status(400).json({
        error: `The following players don't have a game ID registered: ${playerNames}`,
        message: 'All team members must register at least one game ID before tournament registration',
        playersWithoutGameIds: playersWithoutGameIds.map(p => ({
          id: p._id,
          username: p.username
        }))
      });
    }
    if (error.message === 'GAME_MISMATCH') {
      return res.status(400).json({
        error: `Team primary game (${error.meta?.teamGame}) does not match tournament game (${error.meta?.tournamentGame})`
      });
    }
    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic team registration.'
      });
    }

    res.status(500).json({ error: 'Failed to register for tournament' });
  } finally {
    await session.endSession();
  }
});

export default router;