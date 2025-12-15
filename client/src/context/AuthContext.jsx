import React, { createContext, useContext, useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_BACKEND_URL;

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'player' or 'organization'
  const [loading, setLoading] = useState(true);

  // ---------------------------
  // Check if user is logged in
  // ---------------------------
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedRole = localStorage.getItem('userRole');
        if (!storedRole) {
          setLoading(false);
          return;
        }
        let endpoint = null;
        if (storedRole === 'player') {
          endpoint = `${API_URL}/api/players/me`;
        } else if (storedRole === 'organization') {
          endpoint = `${API_URL}/api/organizations/me`;
        }
        if (!endpoint) {
          setLoading(false);
          return;
        }
        const response = await fetch(endpoint, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          setUserRole(storedRole);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setUserRole(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // ---------------------------
  // Universal Login (Player or Organization)
  // ---------------------------
  const login = async (email, password, role = 'player') => {
    try {
      setLoading(true);

      const endpoint = role === 'organization'
        ? `${API_URL}/api/auth/organization/login`
        : `${API_URL}/api/auth/login`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsAuthenticated(true);
        setUserRole(role);
        localStorage.setItem('userRole', role);

        if (role === 'organization') {
          setUser(data.organization);
          return {
            success: true,
            role: 'organization',
            organization: data.organization,
          };
        } else {
          setUser(data.player);
          return {
            success: true,
            role: 'player',
            player: data.player,
            isProfileComplete: isProfileComplete(data.player),
          };
        }
      }

      return { success: false, message: data.message };
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, message: "Network error" };
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // Logout (Universal)
  // ---------------------------
  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      localStorage.removeItem('userRole');
    }
  };

  // ---------------------------
  // Refresh user data manually
  // ---------------------------
  const refreshUser = async () => {
    try {
      const endpoint = userRole === 'organization'
        ? `${API_URL}/api/organizations/me`
        : `${API_URL}/api/players/me`;

      const response = await fetch(endpoint, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  // ---------------------------
  // Helper: Check if profile is complete
  // ---------------------------
  const isProfileComplete = (player) => {
    if (!player) return false;
    return !!(
      player.realName &&
      player.age &&
      player.location &&
      player.country &&
      player.primaryGame &&
      player.teamStatus &&
      player.availability
    );
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        userRole,
        loading,
        login,
        logout,
        refreshUser,
        isProfileComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
