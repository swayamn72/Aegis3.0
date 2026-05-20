import mongoose from 'mongoose';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import Tournament from '../models/tournament.model.js';

/**
 * Returns true if the user may access the match room (registered player or org).
 */
export async function canAccessMatchRoom(userId, userRole, matchId) {
  if (!mongoose.Types.ObjectId.isValid(matchId)) return false;

  const match = await Match.findById(matchId).select('tournament').lean();
  if (!match) return false;

  if (userRole === 'organization') {
    const tournament = await Tournament.findById(match.tournament)
      .select('organizer.organizationRef')
      .lean();
    return tournament?.organizer?.organizationRef?.toString() === userId?.toString();
  }

  const reg = await Registration.findOne({
    tournament: match.tournament,
    'roster.player': userId,
    status: { $in: ['approved', 'checked_in'] },
  })
    .select('_id')
    .lean();

  return Boolean(reg);
}

/**
 * Assert match room access; throws Error with statusCode for HTTP/socket handlers.
 */
export async function assertMatchRoomParticipant(userId, userRole, matchId) {
  const allowed = await canAccessMatchRoom(userId, userRole, matchId);
  if (!allowed) {
    const err = new Error('You are not a participant in this match');
    err.statusCode = 403;
    throw err;
  }
}
