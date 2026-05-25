import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext) || {};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('yjrl_token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('yjrl_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setSession = useCallback((token, userData) => {
    if (token) localStorage.setItem('yjrl_token', token);
    if (userData) setUser(userData);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setSession(res.data.token, res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    setSession(res.data.token, res.data.user);
    return res.data;
  };

  const logout = async () => {
    localStorage.removeItem('yjrl_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
