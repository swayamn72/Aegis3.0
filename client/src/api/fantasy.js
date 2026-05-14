import axiosInstance from '../utils/axiosConfig';

export const getFantasyContests = async (params = {}) => {
  const { data } = await axiosInstance.get('/api/fantasy/contests', { params });
  return data;
};

export const getFeaturedContests = async () => {
  const { data } = await axiosInstance.get('/api/fantasy/featured');
  return data;
};

export const getContestDetails = async (contestId) => {
  const { data } = await axiosInstance.get(`/api/fantasy/contests/${contestId}`);
  return data;
};

export const createSquad = async (contestId, squadData) => {
  const { data } = await axiosInstance.post(`/api/fantasy/contests/${contestId}/squad`, squadData);
  return data;
};

export const updateSquad = async (contestId, squadData) => {
  const { data } = await axiosInstance.put(`/api/fantasy/contests/${contestId}/squad`, squadData);
  return data;
};

export const getMySquad = async (contestId) => {
  const { data } = await axiosInstance.get(`/api/fantasy/contests/${contestId}/my-squad`);
  return data;
};

export const getLeaderboard = async (contestId, params = {}) => {
  const { data } = await axiosInstance.get(`/api/fantasy/contests/${contestId}/leaderboard`, { params });
  return data;
};

export const getMyContests = async () => {
  const { data } = await axiosInstance.get('/api/fantasy/my-contests');
  return data;
};
