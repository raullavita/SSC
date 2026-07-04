/**
 * Installed-client identity — injected at build time per platform.
 * Browser dev builds use REACT_APP_SSC_PLATFORM=electron for local API testing.
 */

const PLATFORM = process.env.REACT_APP_SSC_PLATFORM || 'electron';
const VERSION = process.env.REACT_APP_SSC_VERSION || '0.1.0';
const BUILD = process.env.REACT_APP_SSC_BUILD || '0';

const ALLOWED = new Set(['android', 'ios', 'windows', 'mac', 'electron']);

export function getInstalledClientHeader() {
  const platform = ALLOWED.has(PLATFORM) ? PLATFORM : 'electron';
  return `${platform}/${VERSION}/${BUILD}`;
}

export function getInstalledClientHeaders(extra = {}) {
  return {
    'X-SSC-Client': getInstalledClientHeader(),
    ...extra,
  };
}