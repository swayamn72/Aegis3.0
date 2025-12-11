import axiosInstance from '../utils/axiosConfig';

// Fetch LFT Posts
export const fetchLFTPosts = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.game) params.append('game', filters.game);
    if (filters.region) params.append('region', filters.region);
    if (filters.role) params.append('role', filters.role);

    const { data } = await axiosInstance.get(`/api/recruitment/lft-posts?${params}`);
    return data.posts || [];
};

// Fetch Recruiting Teams
export const fetchRecruitingTeams = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.game) params.append('game', filters.game);
    if (filters.region) params.append('region', filters.region);
    if (filters.role) params.append('role', filters.role);

    const { data } = await axiosInstance.get(`/api/team-applications/recruiting-teams?${params}`);
    return data.teams || [];
};

// Create LFT Post
export const createLFTPost = async (postData) => {
    const { data } = await axiosInstance.post('/api/recruitment/lft-posts', postData);
    return data;
};

// Approach Player
export const approachPlayer = async (playerId, message) => {
    const { data } = await axiosInstance.post(
        `/api/recruitment/approach-player/${playerId}`,
        { message }
    );
    return data;
};

// Approach Team (placeholder for future implementation)
export const approachTeam = async (teamId, message) => {
    const { data } = await axiosInstance.post(
        `/api/recruitment/approach-team/${teamId}`,
        { message }
    );
    return data;
};
