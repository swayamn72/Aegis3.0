import axiosInstance from '../utils/axiosConfig';

// Get player by ID
export const getPlayerById = async (playerId) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}/profile`);
    return data;
};

// Get player rating history (paginated)
export const getPlayerRatingHistory = async (playerId, page = 1, limit = 20) => {
    const { data } = await axiosInstance.get(`/api/players/${playerId}/rating-history`, {
        params: { page, limit },
    });
    return data;
};

// Get Aegis Rating leaderboard (paginated)
export const getAegisLeaderboard = async (page = 1, limit = 25) => {
    const { data } = await axiosInstance.get('/api/players/leaderboard/aegis', {
        params: { page, limit },
    });
    return data;
};
