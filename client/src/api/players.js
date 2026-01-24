import axiosInstance from '../utils/axiosConfig';

// Get player by ID
export const getPlayerById = async (playerId) => {
    if (!playerId) throw new Error('Player ID is required');
    const { data } = await axiosInstance.get(`/api/players/${playerId}/profile`);
    return data;
};
