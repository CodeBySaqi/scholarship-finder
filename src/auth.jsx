import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);

  const refresh = useCallback(async () => {
    const { user } = await api.get('/auth/me');
    setUser(user);
    setBootError(null);
    return user;
  }, []);

  useEffect(() => {
    const onUnauthorized = () => { setUser(null); setBootError(null); };
    window.addEventListener('sf:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sf:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    refresh()
      /* a failed boot must be visible, never an endless spinner */
      .catch(e => { setUser(null); setBootError(e.offline ? 'offline' : (e.status >= 500 ? 'server' : 'unknown')); })
      .finally(() => setLoading(false));
  }, [refresh]);

  const value = {
    user,
    loading,
    bootError,
    retryBoot: async () => {
      setLoading(true); setBootError(null);
      try { await refresh(); } catch (e) { setBootError(e.offline ? 'offline' : (e.status >= 500 ? 'server' : 'unknown')); }
      finally { setLoading(false); }
    },
    refresh,
    setUser,
    login: async (email, password) => {
      const r = await api.post('/auth/login', { email, password });
      setUser(r.user);
      return r.user;
    },
    signup: async (fullName, email, password) => api.post('/auth/signup', { fullName, email, password }),
    verify: async (token) => {
      const r = await api.post('/auth/verify', { token });
      setUser(r.user);
      return r.user;
    },
    logout: async () => {
      await api.post('/auth/logout', {});
      setUser(null);
    }
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
