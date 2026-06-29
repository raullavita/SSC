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
      const playUrl = policy?.android?.play_store_url;
      const preferPlay = !!policy?.android?.prefer_play_store;
      let downloadUrl = apkUrl || null;
      if (preferPlay && playUrl) downloadUrl = playUrl;
      else if (distUrl) downloadUrl = distUrl;
      else if (playUrl) downloadUrl = playUrl;
      return {
        platform: 'android',
        state: 'available',
        localVersion,
        latestVersion: latest,
        downloadUrl,
        useAppDistribution: !!distUrl && !preferPlay,
        usePlayStore: !!playUrl && (preferPlay || !distUrl),
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

  if (isNativeApp() && getPlatform() === 'ios') {
    try {
      const policy = await fetchClientUpdatesPolicy();
      const latest = policy?.latest_version;
      const storeUrl = policy?.ios?.app_store_url;
      const testflightUrl = policy?.ios?.testflight_url;
      const downloadUrl = storeUrl || testflightUrl || null;
      if (!latest) {
        return { platform: 'ios', state: 'unknown', localVersion, downloadUrl };
      }
      if (!isVersionNewer(latest, localVersion)) {
        return {
          platform: 'ios',
          state: 'current',
          localVersion,
          latestVersion: latest,
          downloadUrl,
        };
      }
      return {
        platform: 'ios',
        state: 'available',
        localVersion,
        latestVersion: latest,
        downloadUrl,
        useAppStore: !!storeUrl,
        useTestFlight: !!testflightUrl && !storeUrl,
      };
    } catch (err) {
      return {
        platform: 'ios',
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

export async function openIosUpdateUrl(url) {
  return openAndroidUpdateUrl(url);
}

export async function applyDesktopUpdateFlow() {
  const dl = await downloadDesktopUpdate();
  if (dl?.state === 'error') return dl;
  return installDesktopUpdate();
}

const BACKGROUND_CHECK_DELAY_MS = 45_000;

export { checkDesktopUpdates, downloadDesktopUpdate, installDesktopUpdate } from './desktopUpdates';

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