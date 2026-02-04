import axios from "axios";

const API = axios.create({
  baseURL: "/api/admin",
  withCredentials: true, // SECURITY: Include cookies for authentication
  timeout: 15000, // SECURITY: 15 second timeout to prevent hanging requests
});

// SECURITY: Add request interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    console.error('API Error:', error.response?.data || error.message);

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
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
