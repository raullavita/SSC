/**
 * Hardware-backed secret storage — TASK O.3
 * Electron: OS safeStorage · Android: EncryptedSharedPreferences via native plugin
 */
import { registerPlugin } from '@capacitor/core';
import * as platform from './platform';

function isElectron() {
  return typeof platform.isElectronApp === 'function' && platform.isElectronApp();
}

function isNative() {
  return typeof platform.isNativeApp === 'function' && platform.isNativeApp();
}

const SscDeviceSecret = registerPlugin('SscDeviceSecret');

async function electronGet(key) {
  if (!isElectron() || !window.sscDesktop?.secureStorage?.get) return null;
  try {
    return await window.sscDesktop.secureStorage.get(key);
  } catch {
    return null;
  }
}

async function electronSet(key, value) {
  if (!window.sscDesktop?.secureStorage?.set) return false;
  try {
    await window.sscDesktop.secureStorage.set(key, value);
    return true;
  } catch {
    return false;
  }
}

async function electronRemove(key) {
  if (!window.sscDesktop?.secureStorage?.remove) return;
  try {
    await window.sscDesktop.secureStorage.remove(key);
  } catch {
    /* ignore */
  }
}

async function nativeGet(key) {
  if (!isNative()) return null;
  try {
    const res = await SscDeviceSecret.get({ key });
    return res?.value ?? null;
  } catch {
    return null;
  }
}

async function nativeSet(key, value) {
  if (!isNative()) return false;
  try {
    await SscDeviceSecret.set({ key, value });
    return true;
  } catch {
    return false;
  }
}

async function nativeRemove(key) {
  if (!isNative()) return;
  try {
    await SscDeviceSecret.remove({ key });
  } catch {
    /* ignore */
  }
}

export async function isHardwareSecretStoreAvailable() {
  if (isElectron()) {
    try {
      return !!(await window.sscDesktop?.secureStorage?.isAvailable?.());
    } catch {
      return false;
    }
  }
  if (isNative()) {
    try {
      const res = await SscDeviceSecret.isAvailable();
      return !!res?.available;
    } catch {
      return false;
    }
  }
  return false;
}

export async function getHardwareSecret(key) {
  if (isElectron()) return electronGet(key);
  if (isNative()) return nativeGet(key);
  return null;
}

export async function setHardwareSecret(key, value) {
  if (!value) return false;
  if (isElectron()) return electronSet(key, value);
  if (isNative()) return nativeSet(key, value);
  return false;
}

export async function removeHardwareSecret(key) {
  if (isElectron()) return electronRemove(key);
  if (isNative()) return nativeRemove(key);
}