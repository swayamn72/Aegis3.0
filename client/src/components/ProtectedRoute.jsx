import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedUserTypes, requireRole = null }) => {
  const { isAuthenticated, loading, userType, userRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedUserTypes && !allowedUserTypes.includes(userType)) {
    // Redirect unauthorized users to login or home page
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control
  if (requireRole && userRole !== requireRole) {
    // If organization tries to access player routes, redirect to pending approval
    if (userRole === 'organization' && requireRole === 'player') {
      return <Navigate to="/org/pending-approval" replace />;
    }

    // If player tries to access organization routes, redirect to home
    if (userRole === 'player' && requireRole === 'organization') {
      return <Navigate to="/" replace />;
    }

    // Default: redirect to login for unknown roles
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
