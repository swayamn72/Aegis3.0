import axiosInstance from '../utils/axiosConfig';

/**
 * Fetch paginated match history for a player.
 * Returns matches involving any team the player has been part of.
 */
export const fetchPlayerMatches = async ({ playerId, page = 1, limit = 10 }) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}/matches`, {
        params: { page, limit },
    });
    return data; // { matches, total, page, totalPages }
};

/**
 * Fetch paginated tournament history for a player.
 * Returns registrations across all tournaments the player's team(s) played.
 */
export const fetchPlayerTournaments = async ({ playerId, page = 1, limit = 5 }) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}/tournaments`, {
        params: { page, limit },
    });
    return data; // { tournaments, total, page, totalPages }
};
