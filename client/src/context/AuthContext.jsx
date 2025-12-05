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
  const [loading, setLoading] = useState(true);

  // ---------------------------
  // Check if player is logged in
  // ---------------------------
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/players/me`, {
          credentials: "include",
        });

        if (response.ok) {
          const playerData = await response.json();
          setUser(playerData);
          setIsAuthenticated(true);
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
// Player Login
  // ---------------------------
  const login = async (email, password) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });


      const data = await response.json();

      if (response.ok) {
        setIsAuthenticated(true);
        setUser(data.player);
        return { success: true };
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
// Player Logout
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
      setIsAuthenticated(false);
    }
  };

  // ---------------------------
  // Refresh user data manually
  // ---------------------------
  const refreshUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/players/me`, {
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

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
