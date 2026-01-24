import axiosInstance from '../utils/axiosConfig';

export const fetchPlayerMatches = async ({ playerId, limit = 5, skip = 0 }) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}/matches`, {
        params: { limit, skip }
    });
    return {
        matches: data.matches || [],
        hasMore: data.matches?.length === limit,
        nextSkip: skip + limit
    };
};
