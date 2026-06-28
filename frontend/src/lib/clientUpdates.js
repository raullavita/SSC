/**
 * Installed-client update checks — desktop electron-updater + Android config feed (Q.4).
 */
import { getAppVersion, isVersionNewer } from './appVersion';
import {
  checkDesktopUpdates,
  downloadDesktopUpdate,
  installDesktopUpdate,
} from './desktopUpdates';
import { fetchPublicConfig } from './publicConfig';
import { getPlatform, isElectronApp, isInstalledClient, isNativeApp } from './platform';

export async function fetchClientUpdatesPolicy() {
  const cfg = await fetchPublicConfig();
  return cfg?.client_updates || null;
}

export async function checkForClientUpdate({ manual = false } = {}) {
  const localVersion = getAppVersion();

  if (isElectronApp()) {
    const result = await checkDesktopUpdates({ manual });
    return { platform: 'desktop', localVersion, ...result };
  }

  if (isNativeApp() && getPlatform() === 'android') {
    try {
      const policy = await fetchClientUpdatesPolicy();
      const latest = policy?.latest_version;
      if (!latest) {
        return { platform: 'android', state: 'unknown', localVersion };
      }
      if (!isVersionNewer(latest, localVersion)) {
        return {
          platform: 'android',
          state: 'current',
          localVersion,
          latestVersion: latest,
        };
      }
      const apkUrl = policy?.android?.apk_url;
      const distUrl = policy?.android?.app_distribution_url;
      const downloadUrl = distUrl || apkUrl || null;
      return {
        platform: 'android',
        state: 'available',
        localVersion,
        latestVersion: latest,
        downloadUrl,
        useAppDistribution: !!distUrl,
      };
    } catch (err) {
      return {
        platform: 'android',
        state: 'error',
        localVersion,
        message: err?.message || 'config_unavailable',
      };
    }
  }

  return { platform: 'other', state: 'unsupported', localVersion };
}

export async function openAndroidUpdateUrl(url) {
  if (!url) throw new Error('Update URL missing');
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'fullscreen' });
}

export async function applyDesktopUpdateFlow() {
  const dl = await downloadDesktopUpdate();
  if (dl?.state === 'error') return dl;
  return installDesktopUpdate();
}

const BACKGROUND_CHECK_DELAY_MS = 45_000;

export function scheduleBackgroundUpdateCheck(onAvailable) {
  if (!isInstalledClient() || typeof window === 'undefined') return () => {};
  const timer = setTimeout(async () => {
    try {
      const result = await checkForClientUpdate();
      if (result.state === 'available' && typeof onAvailable === 'function') {
        onAvailable(result);
      }
    } catch {
      /* silent background check */
    }
  }, BACKGROUND_CHECK_DELAY_MS);
  return () => clearTimeout(timer);
}