/**
 * Installed-client identity — injected at build time per platform.
 * Browser dev builds use REACT_APP_SSC_PLATFORM=electron for local API testing.
 */

const PLATFORM = process.env.REACT_APP_SSC_PLATFORM || 'electron';
const VERSION = process.env.REACT_APP_SSC_VERSION || '0.3.0';
const BUILD = process.env.REACT_APP_SSC_BUILD || '8';

const ALLOWED = new Set(['android', 'ios', 'windows', 'mac', 'electron']);

function runtimeClientHeader() {
  if (typeof window !== 'undefined') {
    if (window.__SSC_ELECTRON_CLIENT) {
      return window.__SSC_ELECTRON_CLIENT;
    }
    if (window.__SSC_ANDROID_CLIENT) {
      return window.__SSC_ANDROID_CLIENT;
    }
    if (window.__SSC_IOS_CLIENT) {
      return window.__SSC_IOS_CLIENT;
    }
  }
  return null;
}

export function isIosShell() {
  return typeof window !== 'undefined' && window.__SSC_IOS_SHELL === '1';
}

export function getIosShellFeatures() {
  if (typeof window === 'undefined' || !window.__SSC_IOS_FEATURES) return [];
  return String(window.__SSC_IOS_FEATURES)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}

export function getInstalledClientHeader() {
  const runtime = runtimeClientHeader();
  if (runtime) return runtime;
  const platform = ALLOWED.has(PLATFORM) ? PLATFORM : 'electron';
  return `${platform}/${VERSION}/${BUILD}`;
}

export function getNativeBridgeHeader() {
  if (typeof window !== 'undefined' && window.__SSC_NATIVE_BRIDGE === 'v1') {
    return 'v1';
  }
  return null;
}

export function getInstalledClientHeaders(extra = {}) {
  const headers = {
    'X-SSC-Client': getInstalledClientHeader(),
    ...extra,
  };
  const bridge = getNativeBridgeHeader();
  if (bridge) {
    headers['X-SSC-Native-Bridge'] = bridge;
  }
  return headers;
}

export function isAndroidShell() {
  return typeof window !== 'undefined' && window.__SSC_ANDROID_SHELL === '1';
}

export function getAndroidShellFeatures() {
  if (typeof window === 'undefined' || !window.__SSC_ANDROID_FEATURES) return [];
  return String(window.__SSC_ANDROID_FEATURES)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}