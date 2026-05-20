import axios from 'axios';
import { API_URL } from '../config/apiBase.js';

// Create axios instance with default config
const axiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    timeout: 30000, // 30 seconds
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor — auth via httpOnly cookie (withCredentials)
axiosInstance.interceptors.request.use(
    (config) => config,
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle common errors
        if (error.response) {
            // Server responded with error status
            const { status, data } = error.response;

            if (status === 401) {
                console.error('Unauthorized access');
                localStorage.removeItem('user');
                localStorage.removeItem('userRole');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
            } else if (status === 403) {
                console.error('Forbidden access');
            } else if (status === 500) {
                console.error('Server error');
            }

            // Return the error data for component handling
            return Promise.reject(data);
        } else if (error.request) {
            // Request made but no response
            console.error('No response from server');
            return Promise.reject({ error: 'Network error. Please check your connection.' });
        } else {
            // Something else happened
            console.error('Request setup error:', error.message);
            return Promise.reject({ error: error.message });
        }
    }
);

export default axiosInstance;
