import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { unwrapPrivateKey } from '../lib/crypto';
import { unsubscribePush } from '../lib/push';
import { unsubscribeNativePush } from '../lib/native-push';
import { purgeLegacyPrivateKeyFromSession } from '../lib/vault';
import {
  authHeaders,
  LOGOUT_SERVER_PATH,
  PANIC_SERVER_PATH,
  runLogoutOrchestrator,
  runPanicOrchestrator,
} from '../lib/clientFootprintOrchestrator';
import { registerMemoryWipeHandler } from '../lib/memoryWipe';
import { purgeLegacyVerificationFlags } from '../lib/verification';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    purgeLegacyPrivateKeyFromSession();
    purgeLegacyVerificationFlags();
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    return registerMemoryWipeHandler(() => {
      setUser(null);
      setPrivateKey(null);
    });
  }, []);

  const loginWithToken = async (token, userObj) => {
    localStorage.setItem('ssc_token', token);
    setUser(userObj);
  };

  /** Hold decrypted key in React state only — never written to storage (Engine 2.2). */
  const persistPrivateKey = async (pk) => {
    setPrivateKey(pk);
    return pk;
  };

  const unlockPrivateKey = async (password) => {
    if (!user?.encrypted_private_key || !user?.pk_salt) {
      throw new Error('No encryption key on this account');
    }
    if (!crypto?.subtle) {
      throw new Error('WebCrypto unavailable on this device');
    }
    const pk = await unwrapPrivateKey(user.encrypted_private_key, user.pk_salt, password);
    return persistPrivateKey(pk);
  };

  const setPK = (pk) => setPrivateKey(pk);

  const logout = async () => {
    await runLogoutOrchestrator({
      unsubscribePush: () => unsubscribePush(),
      unsubscribeNativePush: (token) => unsubscribeNativePush(token),
      postLogout: (token) => api.post(LOGOUT_SERVER_PATH, {}, authHeaders(token)),
    });
  };

  const panicWipe = async () => {
    await runPanicOrchestrator({
      postPanicWipe: (token) => api.post(PANIC_SERVER_PATH, {}, authHeaders(token)),
    });
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, privateKey, setPK, loading, refreshUser, loginWithToken, unlockPrivateKey, persistPrivateKey, logout, panicWipe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);