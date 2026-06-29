/**
 * Biometric app unlock — Android BiometricPrompt + macOS Touch ID (Q.49).
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform, isElectronApp, isNativeApp } from './platform';

const SscAppLock = registerPlugin('SscAppLock');

function desktopAppLock() {
  return window.sscDesktop?.appLock;
}

export async function isBiometricUnlockAvailable() {
  if (isNativeApp() && getPlatform() === 'android') {
    try {
      const res = await SscAppLock.isAvailable();
      return !!res?.available;
    } catch {
      return false;
    }
  }
  if (isElectronApp() && desktopAppLock()?.isAvailable) {
    try {
      const res = await desktopAppLock().isAvailable();
      return !!res?.available;
    } catch {
      return false;
    }
  }
  return false;
}

export async function authenticateBiometricUnlock(reason) {
  const prompt = reason || 'Unlock SSC';
  if (isNativeApp() && getPlatform() === 'android') {
    await SscAppLock.authenticate({ reason: prompt });
    return true;
  }
  if (isElectronApp() && desktopAppLock()?.authenticate) {
    await desktopAppLock().authenticate({ reason: prompt });
    return true;
  }
  throw new Error('BIOMETRIC_UNAVAILABLE');
}