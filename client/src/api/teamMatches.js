import axiosInstance from '../utils/axiosConfig';

/**
 * Fetch paginated match history for a team.
 * @param {string} teamId
 * @param {number} page  - 1-indexed page number
 * @param {number} limit - results per page
 * @returns {{ matches: Array, total: number, page: number, totalPages: number }}
 */
export const fetchTeamMatches = async ({ teamId, page = 1, limit = 10 }) => {
    if (!teamId) throw new Error('Team ID is required');
    const { data } = await axiosInstance.get(`/api/teams/${teamId}/matches`, {
        params: { page, limit },
    });
    return data; // { matches, total, page, totalPages }
};

/**
 * Fetch paginated tournament history for a team.
 * @param {string} teamId
 * @param {number} page  - 1-indexed page number
 * @param {number} limit - results per page
 * @returns {{ tournaments: Array, total: number, page: number, totalPages: number }}
 */
export const fetchTeamTournaments = async ({ teamId, page = 1, limit = 10 }) => {
    if (!teamId) throw new Error('Team ID is required');
    const { data } = await axiosInstance.get(`/api/teams/${teamId}/tournaments`, {
        params: { page, limit },
    });
    return data; // { tournaments, total, page, totalPages }
};
