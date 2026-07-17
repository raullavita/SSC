/**
 * Installed-client identity — injected at build time per platform.
 * Browser dev builds use REACT_APP_SSC_PLATFORM=electron for local API testing.
 */

const PLATFORM = process.env.REACT_APP_SSC_PLATFORM || 'electron';
const VERSION = process.env.REACT_APP_SSC_VERSION || '0.3.1';
const BUILD = process.env.REACT_APP_SSC_BUILD || '14';

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

export function getInstalledClientHeader() {
  const runtime = runtimeClientHeader();
  if (runtime) return runtime;
  const platform = ALLOWED.has(PLATFORM) ? PLATFORM : 'electron';
  return `${platform}/${VERSION}/${BUILD}`;
}

function getNativeBridgeHeader() {
  if (typeof window !== 'undefined' && window.__SSC_NATIVE_BRIDGE === 'v1') {
    return 'v1';
  }
  return null;
}

function getDeviceAttestHeader() {
  if (typeof window === 'undefined') return null;
  const attest = window.__SSC_DEVICE_ATTEST;
  if (typeof attest === 'function') {
    return String(attest());
  }
  if (attest) {
    return String(attest);
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
  const attest = getDeviceAttestHeader();
  if (attest) {
    headers['X-SSC-Device-Attest'] = attest;
  }
  return headers;
}

