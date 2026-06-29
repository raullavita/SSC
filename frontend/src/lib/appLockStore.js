/**
 * App lock preferences — Q.49 (installed clients only).
 */
import { isInstalledClient } from './platform';
import { clearAppLockPin } from './appLockPin';

export const APP_LOCK_ENABLED_KEY = 'ssc_app_lock_enabled';
export const APP_LOCK_BIOMETRIC_KEY = 'ssc_app_lock_biometric';
export function isAppLockFeatureAvailable() {
  return isInstalledClient();
}

function readFlag(key) {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(key) === '1';
}

function writeFlag(key, enabled) {
  if (typeof localStorage === 'undefined') return;
  if (enabled) localStorage.setItem(key, '1');
  else localStorage.removeItem(key);
}

export function isAppLockEnabled() {
  return isAppLockFeatureAvailable() && readFlag(APP_LOCK_ENABLED_KEY);
}

export function setAppLockEnabled(enabled) {
  writeFlag(APP_LOCK_ENABLED_KEY, !!enabled);
}

export function isAppLockBiometricPrefEnabled() {
  return isAppLockFeatureAvailable() && readFlag(APP_LOCK_BIOMETRIC_KEY);
}

export function setAppLockBiometricPrefEnabled(enabled) {
  writeFlag(APP_LOCK_BIOMETRIC_KEY, !!enabled);
}

export async function clearAppLockSettings() {
  setAppLockEnabled(false);
  setAppLockBiometricPrefEnabled(false);
  try {
    await clearAppLockPin();
  } catch {
    /* best-effort */
  }
}