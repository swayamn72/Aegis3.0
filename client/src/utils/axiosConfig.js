import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Create axios instance with default config
const axiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    timeout: 30000, // 30 seconds
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        // Add any custom headers or tokens here
        return config;
    },
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
                // Unauthorized - redirect to login if needed
                console.error('Unauthorized access');
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
