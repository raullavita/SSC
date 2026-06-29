/**
 * Native-only initialization. No-op on web/PWA — safe to call everywhere.
 */
import { dispatchDeepLink } from './deepLink';
import { initNativeBackButton } from './nativeBack';
import { closeOAuthBrowser } from './oauthBrowser';
import { isNativeApp } from './platform';
import { initNativePush } from './native-push';
import { drainPendingNotificationReplies, initNotificationReply } from './notificationReply';

let splashHidden = false;
let lastDeepLink = '';

function parseDeepLinkPath(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      path: parsed.pathname || '/',
      search: parsed.search || '',
      hash: parsed.hash || '',
    };
  } catch {
    /* custom scheme fallback: chat.ssc.secure://app/auth/google?... */
    const match = url.match(/^[^:]+:\/\/[^/]+(\/[^?#]*)/);
    if (!match) return null;
    const q = url.indexOf('?');
    const h = url.indexOf('#');
    let search = '';
    let hash = '';
    if (q >= 0) {
      const end = h >= 0 ? h : url.length;
      search = url.slice(q, end);
    }
    if (h >= 0) hash = url.slice(h);
    return { path: match[1] || '/', search, hash };
  }
}

function routeFromDeepLink(url) {
  if (!url || url === lastDeepLink) return;
  const parts = parseDeepLinkPath(url);
  if (!parts) return;
  const { path, search, hash } = parts;
  const target = path + search + hash;
  const routable = path.startsWith('/auth/google')
    || path.startsWith('/chat')
    || path.startsWith('/login')
    || path.startsWith('/register')
    || path.startsWith('/setup');
  if (!routable) return;

  lastDeepLink = url;
  if (path.startsWith('/auth/google')) closeOAuthBrowser();
  dispatchDeepLink(path, search, hash);
}

async function consumeLaunchUrl(App) {
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) routeFromDeepLink(launch.url);
  } catch {
    /* optional */
  }
}

/** Hide the native splash once React has painted. Safe to call multiple times. */
export async function hideNativeSplash() {
  if (splashHidden || !isNativeApp()) return;
  splashHidden = true;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 280 });
  } catch {
    /* optional */
  }
}

async function configureStatusBar(platform) {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0A0A0A' });
    if (platform === 'android') {
      await StatusBar.setOverlaysWebView({ overlay: false });
    } else if (platform === 'ios') {
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    /* optional */
  }
}

export async function initCapacitor() {
  if (!isNativeApp()) return;

  document.documentElement.classList.add('native-app');

  let platform = 'android';
  try {
    const { Capacitor } = await import('@capacitor/core');
    platform = Capacitor.getPlatform();
  } catch {
    /* optional */
  }

  await configureStatusBar(platform);

  // Never leave users stuck on splash if auth/bootstrap hangs.
  setTimeout(() => hideNativeSplash(), 8000);

  try {
    const { App } = await import('@capacitor/app');
    await consumeLaunchUrl(App);
    await App.addListener('appUrlOpen', (event) => {
      routeFromDeepLink(event.url);
    });
    await App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      try {
        const { bootstrapSessionFromDevice } = await import('./sessionStore');
        await bootstrapSessionFromDevice();
      } catch {}
      await consumeLaunchUrl(App);
      await drainPendingNotificationReplies();
    });
  } catch {
    /* optional */
  }

  await initNativePush();
  await initNotificationReply();
  await initNativeBackButton();
}

export { closeOAuthBrowser } from './oauthBrowser';