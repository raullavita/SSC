import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { exchangeOAuthCode } from '../lib/googleAuth';

import { runClientFootprintAudit } from '../lib/clientFootprintOrchestrator';
import { isInstalledApp } from '../lib/appMode';
import { getLocalDeviceId } from '../lib/deviceLink';
import { ensureNotificationPermission } from '../lib/desktopNotify';
import { getInstalledClientHeader } from '../lib/installedClient';
import { fetchTranslationConfig } from '../lib/translationConfig';
import { registerPushTokenIfAvailable } from '../lib/pushRegister';
import { startPresenceHeartbeat, stopPresenceHeartbeat } from '../lib/presence';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';

function warnFootprintViolations() {
  const audit = runClientFootprintAudit();
  if (!audit.localStorage.ok) {
    console.warn('[ssc] localStorage footprint violations:', audit.localStorage.violations);
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wsToken, setWsToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const registerCryptoKeys = useCallback((authUser) => {
    if (!authUser?.id || !isInstalledApp()) return;
    const platform = getInstalledClientHeader().split('/')[0] || 'electron';
    registerDeviceAndPrekeys({
      deviceId: getLocalDeviceId(),
      deviceName: 'SSC Client',
      platform,
      localUserId: authUser.id,
    }).catch((err) => {
      console.warn('[ssc] prekey registration failed', err?.message || err);
    });
  }, []);

  const onAuthenticated = useCallback((data) => {
    setUser(data.user);
    if (data.ws_token) setWsToken(data.ws_token);
    warnFootprintViolations();
    startPresenceHeartbeat();
    registerPushTokenIfAvailable().catch(() => {});
    ensureNotificationPermission().catch(() => {});
    fetchTranslationConfig().catch(() => {});
    registerCryptoKeys(data.user);
    return data.user;
  }, [registerCryptoKeys]);

  const refreshUser = useCallback(async () => {
    const timeoutMs = 8000;
    try {
      const me = await Promise.race([
        api.get('/api/auth/me'),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('auth_refresh_timeout')), timeoutMs);
        }),
      ]);
      const authUser = me?.user ?? me;
      setUser(authUser);
      if (me?.ws_token) setWsToken(me.ws_token);
      warnFootprintViolations();
      startPresenceHeartbeat();
      registerPushTokenIfAvailable().catch(() => {});
      fetchTranslationConfig().catch(() => {});
      registerCryptoKeys(authUser);
      return me;
    } catch {
      setUser(null);
      setWsToken(null);
      stopPresenceHeartbeat();
      return null;
    } finally {
      setLoading(false);
    }
  }, [registerCryptoKeys]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email, password) => {
      const data = await api.post('/api/auth/login', { email, password });
      return onAuthenticated(data);
    },
    [onAuthenticated]
  );

  const register = useCallback(
    async (email, password, displayName, captchaToken = null) => {
      const payload = {
        email,
        password,
        display_name: displayName,
      };
      if (captchaToken) payload.captcha_token = captchaToken;
      const data = await api.post('/api/auth/register', payload);
      return onAuthenticated(data);
    },
    [onAuthenticated]
  );

  const completeGoogleOAuth = useCallback(
    async (oauthCode) => {
      const data = await exchangeOAuthCode(oauthCode);
      return onAuthenticated(data);
    },
    [onAuthenticated]
  );

  const loginWithGoogle = useCallback(
    async (data) => onAuthenticated(data),
    [onAuthenticated]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      /* ignore */
    }
    setUser(null);
    setWsToken(null);
    stopPresenceHeartbeat();
  }, []);

  const value = useMemo(
    () => ({
      user,
      wsToken,
      loading,
      login,
      register,
      logout,
      refreshUser,
      completeGoogleOAuth,
      loginWithGoogle,
    }),
    [user, wsToken, loading, login, register, logout, refreshUser, completeGoogleOAuth, loginWithGoogle]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}