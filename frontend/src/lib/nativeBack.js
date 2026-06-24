/**
 * Android hardware/gesture back — TASK G.3–G.5.
 * ChatHome registers a handler; default minimizes the app on chat list.
 */
import { isNativeApp } from './platform';

let backHandler = null;

export function setNativeBackHandler(fn) {
  backHandler = typeof fn === 'function' ? fn : null;
}

export function clearNativeBackHandler() {
  backHandler = null;
}

export function runNativeBackHandler() {
  if (backHandler) {
    backHandler();
    return true;
  }
  return false;
}

export async function minimizeNativeApp() {
  if (!isNativeApp()) return;
  try {
    const { App } = await import('@capacitor/app');
    if (typeof App.minimizeApp === 'function') {
      await App.minimizeApp();
      return;
    }
    if (typeof App.exitApp === 'function') {
      await App.exitApp();
    }
  } catch {
    /* optional */
  }
}

export async function initNativeBackButton() {
  if (!isNativeApp()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', () => {
      if (runNativeBackHandler()) return;
      minimizeNativeApp();
    });
  } catch {
    /* optional */
  }
}