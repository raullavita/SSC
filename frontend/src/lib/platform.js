/**
 * Platform detection — installed clients (Capacitor + Electron) vs browser dev shell.
 */
let _capacitor = null;

/** True when running inside SSC Electron (Windows / Mac desktop). */
export function isElectronApp() {
  if (typeof window === 'undefined') return false;
  return !!window.sscDesktop?.isDesktop;
}

/** Android APK, iOS shell, or desktop installer — not a browser-tab product surface. */
export function isInstalledClient() {
  return isNativeApp() || isElectronApp();
}

/** Electron loads the CRA bundle via file:// — BrowserRouter breaks; use HashRouter. */
export function prefersHashRouter() {
  if (typeof window === 'undefined') return false;
  if (isElectronApp()) return true;
  if (window.location.protocol === 'file:') return true;
  return process.env.REACT_APP_ELECTRON === 'true';
}

function getCapacitor() {
  if (_capacitor !== null) return _capacitor;
  try {
    // eslint-disable-next-line global-require
    const { Capacitor } = require('@capacitor/core');
    _capacitor = Capacitor;
  } catch {
    _capacitor = false;
  }
  return _capacitor;
}

export function isNativeApp() {
  const Cap = getCapacitor();
  return !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
}

export function getPlatform() {
  const Cap = getCapacitor();
  if (Cap && Cap.getPlatform) return Cap.getPlatform();
  return 'web';
}

/** Backend base URL (no trailing slash). Set at build time via REACT_APP_BACKEND_URL. */
export function getBackendUrl() {
  const raw = process.env.REACT_APP_BACKEND_URL || '';
  const url = raw.trim().replace(/\/$/, '');
  if (!url) {
    if (isNativeApp()) {
      console.warn('[SSC] REACT_APP_BACKEND_URL missing — native app needs your production API URL at build time');
    }
    return 'http://localhost:8000';
  }
  return url;
}

export function supportsWebPush() {
  return !isNativeApp() && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Founder-only: allow browser-tab chat on localhost when REACT_APP_BROWSER_DEV=true */
export function isBrowserDevAllowed() {
  return process.env.REACT_APP_BROWSER_DEV === 'true';
}