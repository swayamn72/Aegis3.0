import axiosInstance from '../utils/axiosConfig';

// Connections API
export const getConnections = async () => {
    const { data } = await axiosInstance.get('/api/connections');
    return data;
};

// Team API
export const getTeam = async (teamId) => {
    if (!teamId) throw new Error('Team ID is required');
    const { data } = await axiosInstance.get(`/api/teams/${teamId}`);
    return data.team;
};

// Posts API
export const getPlayerPosts = async ({ playerId, includeMedia = true }) => {
    const { data } = await axiosInstance.get(
        `/api/posts/player/${playerId}?includeMedia=${includeMedia}`
    );
    return data.posts || data;
};

export const getAllPosts = async () => {
    const { data } = await axiosInstance.get('/api/posts');
    return Array.isArray(data) ? data : data.posts || [];
};

export const updatePost = async ({ postId, caption }) => {
    const { data } = await axiosInstance.put(`/api/posts/${postId}`, { caption });
    return data.post;
};

export const deletePost = async (postId) => {
    await axiosInstance.delete(`/api/posts/${postId}`);
    return { postId };
};
