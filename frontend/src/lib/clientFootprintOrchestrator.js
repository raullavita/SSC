/**
 * Unified client footprint orchestrator — Engine 3 Step 3.6.
 * Phase 1 (sync) completes before any server I/O; panic works offline.
 */
import { dispatchMemoryWipe } from './memoryWipe';
import { clearLocalStorageSessionSecrets } from './localStorageFootprint';
import { clearSessionStorageFootprint } from './sessionStorageFootprint';
import { purgeLegacyPrivateKeyFromSession } from './vault';
import { purgeLegacyVerificationFlags } from './verification';

export const PANIC_REDIRECT = '/login?panic=1';
export const PANIC_SERVER_PATH = '/panic-wipe';
export const LOGOUT_SERVER_PATH = '/auth/logout';

function capturePreWipeCredentials() {
  if (typeof localStorage === 'undefined') {
    return { authToken: null, nativePushToken: null };
  }
  return {
    authToken: localStorage.getItem('ssc_token'),
    nativePushToken: localStorage.getItem('ssc_native_push_token'),
  };
}

function authHeaders(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/**
 * Phase 1 — synchronous client wipe (memory, storage secrets, caches).
 * Safe when offline; does not await network.
 * @param {'logout'|'panic'} reason
 */
export function executeClientFootprintWipe(reason) {
  dispatchMemoryWipe(reason);
  clearLocalStorageSessionSecrets();
  purgeLegacyPrivateKeyFromSession();
  clearSessionStorageFootprint(reason);
  if (reason === 'logout') {
    purgeLegacyVerificationFlags();
  }
}

async function sendNativeAppToBackground() {
  try {
    const { isNativeApp } = await import('./platform');
    if (!isNativeApp()) return;
    const { App } = await import('@capacitor/app');
    if (typeof App.minimizeApp === 'function') {
      await App.minimizeApp();
    }
  } catch {
    /* web/PWA — redirect is sufficient */
  }
}

/**
 * Panic: client wipe → server purge (best-effort) → background (native) → login redirect.
 * @param {{ postPanicWipe: (token: string|null) => Promise<unknown> }} deps
 */
export async function runPanicOrchestrator({ postPanicWipe }) {
  const { authToken } = capturePreWipeCredentials();
  executeClientFootprintWipe('panic');
  try {
    await postPanicWipe(authToken);
  } catch {
    /* offline-safe — local wipe already complete */
  }
  await sendNativeAppToBackground();
  if (typeof window !== 'undefined') {
    window.location.href = PANIC_REDIRECT;
  }
}

/**
 * Logout: client wipe → push unsubscribe → server logout (best-effort).
 * @param {{
 *   postLogout: (token: string|null) => Promise<unknown>,
 *   unsubscribePush?: () => Promise<unknown>,
 *   unsubscribeNativePush?: (token: string|null) => Promise<unknown>,
 * }} deps
 */
export async function runLogoutOrchestrator({
  postLogout,
  unsubscribePush,
  unsubscribeNativePush,
}) {
  const { authToken, nativePushToken } = capturePreWipeCredentials();
  executeClientFootprintWipe('logout');
  try {
    await unsubscribePush?.();
  } catch {
    /* ignore */
  }
  try {
    await unsubscribeNativePush?.(nativePushToken);
  } catch {
    /* ignore */
  }
  try {
    await postLogout(authToken);
  } catch {
    /* ignore */
  }
}

export { authHeaders };