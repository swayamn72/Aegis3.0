import axiosInstance from '../utils/axiosConfig';

// Fetch all tournaments (array or object response supported)
export const getTournaments = async () => {
    const { data } = await axiosInstance.get('/api/tournaments/all');
    return data;
};