import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('stocksense_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('stocksense_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getMe();
      setUser(userData);
      return userData;
    } catch (error) {
      console.warn('Failed to refresh user profile:', error.message);
      logout();
      return null;
    }
  }, [logout]);

  // Initial authentication check on application boot
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('stocksense_token');
      if (storedToken) {
        try {
          const userData = await authService.getMe();
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          console.warn('Invalid session on initialization:', error.message);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();

    // Listen for unauthorized interceptor event
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('stocksense:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('stocksense:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async ({ email, password }) => {
    const res = await authService.login({ email, password });
    if (res.token) {
      localStorage.setItem('stocksense_token', res.token);
      setToken(res.token);
      setUser(res.user);
    }
    return res;
  };

  const register = async ({ name, email, password, role }) => {
    return await authService.register({ name, email, password, role });
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
