/**
 * Native-only initialization. No-op on web/PWA — safe to call everywhere.
 */
import { isNativeApp } from './platform';
import { initNativePush } from './native-push';

let splashHidden = false;

async function closeOAuthBrowser() {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {
    /* optional */
  }
}

function routeFromDeepLink(url) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname || '/';
    const target = path + parsed.search + parsed.hash;
    if (
      path.startsWith('/auth/google')
      || path.startsWith('/chat')
      || path.startsWith('/login')
      || path.startsWith('/register')
      || path.startsWith('/setup')
    ) {
      if (path.startsWith('/auth/google')) closeOAuthBrowser();
      window.location.assign(target);
    }
  } catch {
    /* ignore unknown deep links */
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
    const launch = await App.getLaunchUrl();
    if (launch?.url) routeFromDeepLink(launch.url);
    await App.addListener('appUrlOpen', (event) => {
      routeFromDeepLink(event.url);
    });
  } catch {
    /* optional */
  }

  await initNativePush();
}