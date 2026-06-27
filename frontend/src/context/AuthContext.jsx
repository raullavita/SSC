import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
import {
  bootstrapSessionFromDevice,
  clearSessionToken,
  persistSessionToken,
  purgeLegacyJwtFromStorage,
} from '../lib/sessionStore';
import { purgeLegacyVerificationFlags } from '../lib/verification';
import { ensurePreKeysUploaded } from '../lib/signal/prekeys';
import { bootstrapSignalIdentity } from '../lib/signalIdentityBootstrap';
import { isInstalledClient } from '../lib/platform';
import {
  saveVaultCredential,
  loadVaultCredential,
  clearVaultCredential,
} from '../lib/vaultCredentialStore';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState(null);
  const autoUnlockAttempted = useRef(null);

  const tryAutoUnlockVault = useCallback(async (userData, { force = false } = {}) => {
    if (!userData?.encrypted_private_key || !userData?.pk_salt) return null;
    if (!force && autoUnlockAttempted.current === userData.user_id) return null;
    const password = await loadVaultCredential(userData.user_id);
    if (!password) return null;
    autoUnlockAttempted.current = userData.user_id;
    try {
      const pk = await unwrapPrivateKey(userData.encrypted_private_key, userData.pk_salt, password);
      setPrivateKey(pk);
      return pk;
    } catch {
      clearVaultCredential(userData.user_id);
      autoUnlockAttempted.current = null;
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      ensurePreKeysUploaded().catch(() => {});
      await tryAutoUnlockVault(data);
      return data;
    } catch (err) {
      setUser(null);
      if (err?.response?.status === 401) {
        clearSessionToken();
        autoUnlockAttempted.current = null;
      }
      return null;
    }
  }, [tryAutoUnlockVault]);

  const runSilentBootstrap = useCallback(async () => {
    if (!isInstalledClient()) return;
    await bootstrapSignalIdentity(refreshUser).catch(() => {});
  }, [refreshUser]);

  useEffect(() => {
    purgeLegacyPrivateKeyFromSession();
    purgeLegacyVerificationFlags();
    purgeLegacyJwtFromStorage();
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    (async () => {
      await bootstrapSessionFromDevice();
      const data = await refreshUser();
      if (data) await runSilentBootstrap();
      setLoading(false);
    })();
  }, [refreshUser, runSilentBootstrap]);

  useEffect(() => {
    if (!user?.encrypted_private_key || privateKey) return;
    tryAutoUnlockVault(user, { force: true }).catch(() => {});
  }, [user, privateKey, tryAutoUnlockVault]);

  useEffect(() => {
    return registerMemoryWipeHandler(() => {
      setUser(null);
      setPrivateKey(null);
      autoUnlockAttempted.current = null;
      clearSessionToken();
    });
  }, []);

  const loginWithToken = async (token, userObj) => {
    await persistSessionToken(token);
    setUser(userObj);
    autoUnlockAttempted.current = null;
    ensurePreKeysUploaded().catch(() => {});
    await tryAutoUnlockVault(userObj);
    if (isInstalledClient()) {
      await bootstrapSignalIdentity(refreshUser).catch(() => {});
      await refreshUser();
    }
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
    if (user?.user_id) {
      await saveVaultCredential(user.user_id, password);
    }
    return persistPrivateKey(pk);
  };

  const setPK = (pk) => setPrivateKey(pk);

  const logout = async () => {
    const uid = user?.user_id;
    await runLogoutOrchestrator({
      unsubscribePush: () => unsubscribePush(),
      unsubscribeNativePush: (token) => unsubscribeNativePush(token),
      postLogout: (token) => api.post(LOGOUT_SERVER_PATH, {}, authHeaders(token)),
      userId: uid,
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