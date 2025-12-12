import axiosInstance from '../utils/axiosConfig';

// Fetch all players with pagination
export const fetchPlayers = async ({ limit = 20, skip = 0 }) => {
    const { data } = await axiosInstance.get('/api/players/all', {
        params: { limit, skip }
    });
    return {
        players: data.players || [],
        hasMore: data.players?.length === limit,
        nextSkip: skip + limit
    };
};

// Get player by ID
export const getPlayerById = async (playerId) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}`);
    return data;
};
