/**
 * Google Sign-In — redirect flow (installed clients) + optional GIS ID token (desktop web).
 */

import { api } from './api';
import { isInstalledApp } from './appMode';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

export function googleAuthEnabled() {
  return Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID || API_BASE);
}

/** Installed Electron/Android/iOS must use full redirect — GIS One Tap hangs on file:// origins. */
function shouldUseGoogleRedirect() {
  return isInstalledApp();
}

function isElectronShell() {
  return typeof window !== 'undefined' && Boolean(window.__SSC_ELECTRON_CLIENT);
}

async function startGoogleRedirect() {
  const base = API_BASE || `${window.location.protocol}//${window.location.host}`;
  const installed = shouldUseGoogleRedirect();
  const clientQuery = installed ? '?client=installed' : '';
  const url = `${base}/api/auth/google/start${clientQuery}`;
  if (isElectronShell() && window.sscShell?.openOAuth) {
    await window.sscShell.openOAuth(url);
    return;
  }
  window.location.href = url;
}

export async function exchangeOAuthCode(oauthCode) {
  return api.post('/api/auth/google/exchange', { oauth_code: oauthCode });
}

async function signInWithIdToken(idToken) {
  return api.post('/api/auth/google/idtoken', { id_token: idToken });
}

let gsiPromise = null;

function loadGsiScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-ssc-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.sscGsi = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/** GIS popup — desktop dev when REACT_APP_GOOGLE_CLIENT_ID is set. */
export async function promptGoogleSignIn() {
  if (shouldUseGoogleRedirect()) {
    await startGoogleRedirect();
    return null;
  }

  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!clientId) {
    startGoogleRedirect();
    return null;
  }
  const loaded = await loadGsiScript();
  if (!loaded || !window.google?.accounts?.id) {
    startGoogleRedirect();
    return null;
  }
  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const data = await signInWithIdToken(response.credential);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      },
    });
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        startGoogleRedirect();
      }
    });
  });
}