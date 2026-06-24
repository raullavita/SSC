/**
 * Google OAuth browser surface — TASK G.1.
 * Native: InAppBrowser (Capacitor Browser) so the app shell stays underneath.
 * Desktop: full navigation (Electron intercepts redirect).
 */
import { isNativeApp } from './platform';

export async function closeOAuthBrowser() {
  if (!isNativeApp()) return;
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {
    /* already closed */
  }
}

export async function openOAuthUrl(url) {
  if (!url) throw new Error('OAuth URL missing');
  if (isNativeApp()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'fullscreen' });
    return;
  }
  window.location.href = url;
}