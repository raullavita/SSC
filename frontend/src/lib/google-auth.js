/**
 * Google Sign-In — web (GIS popup) + native (browser redirect via backend OAuth).
 */
import { api, API } from './api';
import { isNativeApp } from './platform';

let gsiLoaded = false;

function loadGsiScript() {
  if (gsiLoaded || typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      gsiLoaded = true;
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-ssc-gsi]');
    if (existing) {
      existing.addEventListener('load', () => { gsiLoaded = true; resolve(); });
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.sscGsi = '1';
    s.onload = () => { gsiLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function fetchGoogleConfig() {
  try {
    const { data } = await api.get('/auth/google/config');
    return data;
  } catch {
    return { enabled: false, client_id: '' };
  }
}

/** Complete sign-in after backend returns token + user. */
export async function completeGoogleAuth({ token, user, needs_username }, { loginWithToken, navigate }) {
  await loginWithToken(token, user);
  if (needs_username || !user?.username || !user?.public_key) {
    navigate('/setup', { state: { user } });
    return;
  }
  navigate('/chat');
}

/** Native: full WebView redirect via backend OAuth (returns to http://localhost/auth/google). */
export async function signInWithGoogleNative() {
  window.location.href = `${API}/auth/google/start?platform=native`;
  return true;
}

/** Web: Google Identity Services one-tap / popup → id_token → backend. */
export function signInWithGoogleWeb(clientId, { onBusy, onError }) {
  return new Promise((resolve, reject) => {
    loadGsiScript()
      .then(() => {
        if (!window.google?.accounts?.id) {
          reject(new Error('Google Sign-In failed to load'));
          return;
        }
        onBusy?.(true);
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              const { data } = await api.post('/auth/google/session', {
                id_token: response.credential,
              });
              resolve(data);
            } catch (err) {
              onError?.(err?.response?.data?.detail || 'Google sign-in failed');
              reject(err);
            } finally {
              onBusy?.(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback: full-page redirect via backend OAuth
            onBusy?.(false);
            window.location.href = `${API}/auth/google/start?platform=web`;
          }
        });
      })
      .catch((e) => {
        onBusy?.(false);
        reject(e);
      });
  });
}

/** Unified entry — picks native vs web automatically. */
export async function signInWithGoogle({ loginWithToken, navigate, onBusy, onError }) {
  const cfg = await fetchGoogleConfig();
  if (!cfg.enabled && !cfg.client_id) {
    onError?.('Google sign-in is not configured on the server yet.');
    return null;
  }

  if (isNativeApp()) {
    onBusy?.(true);
    try {
      await signInWithGoogleNative();
      return null; // completion happens via /auth/google callback route
    } finally {
      onBusy?.(false);
    }
  }

  try {
    onBusy?.(true);
    const data = await signInWithGoogleWeb(cfg.client_id, { onBusy, onError });
    if (data) {
      await completeGoogleAuth(
        { token: data.token, user: data.user, needs_username: data.needs_username },
        { loginWithToken, navigate },
      );
    }
    return data;
  } catch (e) {
    onError?.(e?.message || 'Google sign-in failed');
    return null;
  } finally {
    onBusy?.(false);
  }
}