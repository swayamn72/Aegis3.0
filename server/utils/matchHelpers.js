/**
 * Match serialization and legacy field helpers.
 */

/** Team IDs participating in a match (from results or vsResults). */
export function getTeamIdsFromMatch(match) {
  const ids = new Set();
  if (!match) return [];

  for (const r of match.results || []) {
    const tid = r.team?._id?.toString?.() ?? r.team?.toString?.();
    if (tid) ids.add(tid);
  }
  if (match.vsResults?.teamA) {
    const a = match.vsResults.teamA._id?.toString?.() ?? match.vsResults.teamA.toString?.();
    if (a) ids.add(a);
  }
  if (match.vsResults?.teamB) {
    const b = match.vsResults.teamB._id?.toString?.() ?? match.vsResults.teamB.toString?.();
    if (b) ids.add(b);
  }
  return [...ids];
}

/** End time for sorting (completedAt or updatedAt). */
export function getMatchEndTime(match) {
  if (!match) return null;
  return match.completedAt || match.updatedAt || match.scheduledStartTime || null;
}

/** Strip sensitive fields from match documents returned to unauthenticated clients. */
export function toPublicMatch(match) {
  if (!match) return match;
  const out = { ...match };
  delete out.roomCredentials;
  delete out.notes;
  return out;
}
