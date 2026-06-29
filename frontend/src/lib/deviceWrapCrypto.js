/**
 * Device-bound AES-GCM wrap — shared by vault credentials and session persistence.
 * Plaintext secrets never stored in localStorage; hardware-backed when available (TASK O.3).
 */
import {
  getHardwareSecret,
  isHardwareSecretStoreAvailable,
  removeHardwareSecret,
  setHardwareSecret,
} from './hardwareSecretStore';

export const DEVICE_WRAP_KEY = 'ssc_device_wrap_secret';

function toB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromB64(b64s) {
  return Uint8Array.from(atob(b64s), (c) => c.charCodeAt(0));
}

async function readWrapKeyMaterial() {
  if (typeof crypto?.subtle === 'undefined') return null;
  const hw = await isHardwareSecretStoreAvailable();
  if (hw) {
    const stored = await getHardwareSecret(DEVICE_WRAP_KEY);
    if (stored) return stored;
    if (typeof localStorage !== 'undefined') {
      const legacy = localStorage.getItem(DEVICE_WRAP_KEY);
      if (legacy) {
        await writeWrapKeyMaterial(legacy);
        return legacy;
      }
    }
    return null;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(DEVICE_WRAP_KEY);
  }
  return null;
}

/** One-time migration for legacy installs — safe to call on every cold start. */
export async function migrateDeviceWrapKeyToHardware() {
  if (typeof crypto?.subtle === 'undefined') return false;
  const hw = await isHardwareSecretStoreAvailable();
  if (!hw || typeof localStorage === 'undefined') return false;
  const legacy = localStorage.getItem(DEVICE_WRAP_KEY);
  if (!legacy) return false;
  const existing = await getHardwareSecret(DEVICE_WRAP_KEY);
  if (existing) {
    localStorage.removeItem(DEVICE_WRAP_KEY);
    return true;
  }
  await writeWrapKeyMaterial(legacy);
  return !localStorage.getItem(DEVICE_WRAP_KEY);
}

async function writeWrapKeyMaterial(material) {
  const hw = await isHardwareSecretStoreAvailable();
  if (hw) {
    const ok = await setHardwareSecret(DEVICE_WRAP_KEY, material);
    if (ok) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(DEVICE_WRAP_KEY);
      return;
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEVICE_WRAP_KEY, material);
  }
}

export async function getDeviceWrapKey() {
  if (typeof crypto?.subtle === 'undefined') return null;
  let stored = await readWrapKeyMaterial();
  if (!stored) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    stored = toB64(raw);
    await writeWrapKeyMaterial(stored);
  }
  const bytes = fromB64(stored);
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** @returns {Promise<string|null>} `ciphertext.iv` base64 pair */
export async function wrapDeviceSecret(plaintext) {
  if (!plaintext) return null;
  const key = await getDeviceWrapKey();
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toB64(ct)}.${toB64(iv)}`;
}

/** @returns {Promise<string|null>} */
export async function unwrapDeviceSecret(blob) {
  if (!blob) return null;
  const key = await getDeviceWrapKey();
  if (!key) return null;
  try {
    const [ctB64, ivB64] = blob.split('.');
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) },
      key,
      fromB64(ctB64),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export async function clearDeviceWrapSecret() {
  await removeHardwareSecret(DEVICE_WRAP_KEY);
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(DEVICE_WRAP_KEY);
}