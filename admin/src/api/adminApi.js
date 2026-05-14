import axios from "axios";

const API = axios.create({
  baseURL: "/api/admin",
  withCredentials: true, // SECURITY: Include cookies for authentication
  timeout: 15000, // SECURITY: 15 second timeout to prevent hanging requests
});

// SECURITY: Add request interceptor to include auth token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// SECURITY: Add response interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    console.error('API Error:', error.response?.data || error.message);

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Token expired or invalid - clear token and redirect to login
      localStorage.removeItem('adminToken');
      window.location.href = '/admin';
    }

    return Promise.reject(error);
  }
);

// ==================== AUTH APIs ====================

// login admin
export const adminLoginAPI = async (credentials) => {
  const { data } = await API.post("/login", credentials);
  return data;
};

// ==================== TOURNAMENT APIs ====================

// Fetch tournaments with filters and pagination
export const fetchTournamentsAPI = async (params = {}) => {
  try {
    const { data } = await API.get("/tournaments", { params });
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get single tournament details
export const getTournamentAPI = async (id) => {
  try {
    // SECURITY: Validate ID format on client side
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid tournament ID');
    }
    const { data } = await API.get(`/tournaments/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get pending tournaments
export const getPendingTournamentsAPI = async () => {
  try {
    const { data } = await API.get("/tournaments/pending/list");
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Approve tournament
export const approveTournamentAPI = async (id) => {
  try {
    // SECURITY: Validate ID format on client side
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid tournament ID');
    }
    const { data } = await API.patch(`/tournaments/${id}/approve`);
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Reject tournament
export const rejectTournamentAPI = async (id, reason) => {
  try {
    // SECURITY: Validate inputs on client side
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid tournament ID');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters');
    }
    if (reason.length > 500) {
      throw new Error('Rejection reason must not exceed 500 characters');
    }

    const { data } = await API.patch(`/tournaments/${id}/reject`, {
      reason: reason.trim()
    });
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Update tournament status
export const updateTournamentStatusAPI = async (id, status) => {
  try {
    // SECURITY: Validate inputs on client side
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid tournament ID');
    }

    const validStatuses = ['announced', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled', 'postponed'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status value');
    }

    const { data } = await API.patch(`/tournaments/${id}/status`, { status });
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// ==================== MODERATION REPORT APIs ====================

export const fetchReportsAPI = async (params = {}) => {
  try {
    const { data } = await API.get('/reports', { params });
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const updateReportStatusAPI = async ({ reportId, status, adminNotes = '' }) => {
  try {
    if (!reportId || typeof reportId !== 'string') throw new Error('Invalid report ID');
    if (!['open', 'in_review', 'actioned', 'dismissed'].includes(status)) throw new Error('Invalid report status');
    const { data } = await API.patch(`/reports/${reportId}`, { status, adminNotes });
    return data;
  } catch (error) { throw error.response?.data || error; }
};

// ==================== SHADOW PLAYER APIs ====================
export const createShadowPlayerAPI = async (playerData) => {
  const { data } = await API.post('/players/shadow', playerData);
  return data;
};
export const fetchShadowPlayersAPI = async (params = {}) => {
  const { data } = await API.get('/players/shadow', { params });
  return data;
};
export const updateShadowPlayerAPI = async (id, playerData) => {
  const { data } = await API.put(`/players/shadow/${id}`, playerData);
  return data;
};
export const claimShadowPlayerAPI = async (id, realPlayerId) => {
  const { data } = await API.post(`/players/shadow/${id}/claim`, { realPlayerId });
  return data;
};
export const bulkCreateShadowPlayersAPI = async (players) => {
  const { data } = await API.post('/players/shadow/bulk', { players });
  return data;
};
export const searchPlayersAPI = async (q) => {
  const { data } = await API.get('/players/search', { params: { q } });
  return data;
};

// ==================== ADMIN TOURNAMENT CREATE APIs ====================
export const createTournamentAPI = async (tournamentData) => {
  const { data } = await API.post('/tournaments/create', tournamentData);
  return data;
};
export const editTournamentAPI = async (id, tournamentData) => {
  const { data } = await API.put(`/tournaments/${id}/edit`, tournamentData);
  return data;
};
export const updateMapPoolAPI = async (id, maps) => {
  if (!id || typeof id !== 'string') throw new Error('Invalid tournament ID');
  if (!Array.isArray(maps) || maps.length === 0) throw new Error('Maps must be a non-empty array');
  const { data } = await API.patch(`/tournaments/${id}/map-pool`, { maps });
  return data;
};

// ==================== ADMIN TEAM APIs ====================
export const createTeamAPI = async (teamData) => {
  const { data } = await API.post('/teams/create', teamData);
  return data;
};

// ==================== MATCH APIs ====================
export const createMatchAPI = async (tournamentId, matchData) => {
  const { data } = await API.post(`/tournaments/${tournamentId}/matches`, matchData);
  return data;
};
export const updateMatchResultsAPI = async (matchId, results) => {
  const { data } = await API.put(`/matches/${matchId}/results`, { results });
  return data;
};
export const finalizeMatchAPI = async (matchId) => {
  const { data } = await API.post(`/matches/${matchId}/finalize`);
  return data;
};

// ==================== LIVE SCORING APIs ====================
export const startLiveScoringAPI = async (matchId) => {
  const { data } = await API.post(`/matches/${matchId}/live/start`);
  return data;
};
export const addLiveKillAPI = async (matchId, { teamId, playerId, kills }) => {
  const { data } = await API.post(`/matches/${matchId}/live/kill`, { teamId, playerId, kills });
  return data;
};
export const eliminateTeamAPI = async (matchId, teamId) => {
  const { data } = await API.post(`/matches/${matchId}/live/eliminate`, { teamId });
  return data;
};
export const endLiveScoringAPI = async (matchId) => {
  const { data } = await API.post(`/matches/${matchId}/live/end`);
  return data;
};
export const getLiveMatchAPI = async (matchId) => {
  const { data } = await API.get(`/matches/${matchId}/live`);
  return data;
};

// ==================== VALORANT MATCH APIs ====================
const MATCH_API = axios.create({ baseURL: '/api/matches', withCredentials: true, timeout: 15000 });
MATCH_API.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const submitValorantResultsAPI = async (matchId, resultData) => {
  const { data } = await MATCH_API.post(`/${matchId}/valorant-results`, resultData);
  return data;
};

// ==================== FANTASY ADMIN APIs ====================
const FANTASY_API = axios.create({ baseURL: '/api/fantasy', withCredentials: true, timeout: 15000 });
FANTASY_API.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const createFantasyContestAPI = async (contestData) => {
  const { data } = await FANTASY_API.post('/contests', contestData);
  return data;
};
export const updateFantasyContestAPI = async (id, contestData) => {
  const { data } = await FANTASY_API.put(`/contests/${id}`, contestData);
  return data;
};
export const setPlayerPoolAPI = async (contestId, players) => {
  const { data } = await FANTASY_API.post(`/contests/${contestId}/player-pool`, { players });
  return data;
};
export const triggerFantasyScoringAPI = async (contestId, matchId) => {
  const { data } = await FANTASY_API.post(`/contests/${contestId}/score`, matchId ? { matchId } : {});
  return data;
};
export const fetchFantasyContestsAdminAPI = async (params = {}) => {
  const { data } = await FANTASY_API.get('/admin/contests', { params });
  return data;
};
export const updateContestStatusAPI = async (id, status) => {
  const { data } = await FANTASY_API.patch(`/contests/${id}/status`, { status });
  return data;
};
