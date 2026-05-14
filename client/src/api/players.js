import axiosInstance from '../utils/axiosConfig';

export const fetchPlayers = async ({ limit = 20, skip = 0 } = {}) => {
    const page = Math.floor(skip / limit) + 1;
    const { data } = await axiosInstance.get('/api/players/discover', {
        params: {
            page,
            limit,
            sortBy: 'aegisRating',
            sortOrder: 'desc',
        },
    });

    const players = data.players || [];
    const pagination = data.pagination || {};

    return {
        players,
        hasMore: (pagination.page || 1) < (pagination.totalPages || 1),
        nextSkip: skip + players.length,
    };
};

export const fetchDiscoverPlayers = async ({
    q = '',
    role = '',
    primaryGame = '',
    sortBy = 'aegisRating',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
} = {}) => {
    const { data } = await axiosInstance.get('/api/players/discover', {
        params: {
            q,
            role,
            primaryGame,
            sortBy,
            sortOrder,
            page,
            limit,
        },
    });
    return data;
};

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

// Get live Valorant rank + recent 5 matches for any player (public)
export const getPlayerValorantProfile = async (playerId) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}/valorant-profile`);
    return data;
};
