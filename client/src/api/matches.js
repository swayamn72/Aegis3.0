import axiosInstance from '../utils/axiosConfig';

/**
 * Fetch a single match by ID.
 * Populates: results.team (teamName, teamTag, logo), tournament (tournamentName)
 */
export const fetchMatchById = async (matchId) => {
    const { data } = await axiosInstance.get(`/api/matches/${matchId}`);
    return data;
};

/**
 * Fetch paginated matches for a tournament.
 */
export const fetchTournamentMatches = async (tournamentId, { status, phase, limit = 20, offset = 0 } = {}) => {
    const params = { limit, offset };
    if (status) params.status = status;
    if (phase) params.phase = phase;
    const { data } = await axiosInstance.get(`/api/matches/tournament/${tournamentId}`, { params });
    return data;
};
