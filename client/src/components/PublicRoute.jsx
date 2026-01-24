import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading, userRole } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    // If user is authenticated, redirect them away from login/signup
    if (isAuthenticated) {
        // Redirect based on user role
        if (userRole === 'organization') {
            return <Navigate to="/org/dashboard" replace />;
        }
        // Default to home for players
        return <Navigate to="/" replace />;
    }

    // If not authenticated, render the login/signup page
    return children;
};

export default PublicRoute;
