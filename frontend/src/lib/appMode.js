/**
 * Distinguish installed clients (Electron / Android / iOS) from the public marketing site.
 */

const INSTALLED_PLATFORMS = new Set(['electron', 'android', 'ios', 'windows', 'mac']);

export function isMarketingWebOnly() {
  return process.env.REACT_APP_SSC_LANDING_ONLY === 'true';
}

export function isInstalledApp() {
  if (isMarketingWebOnly()) return false;

  if (typeof window !== 'undefined') {
    if (window.__SSC_ELECTRON_CLIENT) return true;
    if (window.__SSC_ANDROID_CLIENT) return true;
    if (window.__SSC_IOS_CLIENT) return true;
  }

  const platform = (process.env.REACT_APP_SSC_PLATFORM || '').trim().toLowerCase();
  return INSTALLED_PLATFORMS.has(platform);
}

export function appVersionLabel() {
  const version = process.env.REACT_APP_SSC_VERSION || '0.3.1';
  const build = process.env.REACT_APP_SSC_BUILD || '0';
  return `v${version} (build ${build})`;
}