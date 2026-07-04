import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { startPresenceHeartbeat, stopPresenceHeartbeat } from '../lib/presence';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get('/api/auth/me');
      setUser(me);
      startPresenceHeartbeat();
      return me;
    } catch {
      setUser(null);
      stopPresenceHeartbeat();
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    setUser(data.user);
    startPresenceHeartbeat();
    return data.user;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const data = await api.post('/api/auth/register', {
      email,
      password,
      display_name: displayName,
    });
    setUser(data.user);
    startPresenceHeartbeat();
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      /* ignore */
    }
    setUser(null);
    stopPresenceHeartbeat();
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}