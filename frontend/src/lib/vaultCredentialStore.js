/**
 * Device-bound vault unlock credential — invisible to users (TASK A).
 * Stores password wrapped with a per-device AES key (never the RSA private key).
 * Cleared on logout / panic wipe.
 */
import { isInstalledClient } from './platform';

const DEVICE_WRAP_KEY = 'ssc_device_wrap_secret';
const credStorageKey = (userId) => `ssc_vault_wrap_${userId}`;

async function getDeviceWrapKey() {
  if (typeof crypto?.subtle === 'undefined' || typeof localStorage === 'undefined') return null;
  let stored = localStorage.getItem(DEVICE_WRAP_KEY);
  if (!stored) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    stored = btoa(String.fromCharCode(...raw));
    localStorage.setItem(DEVICE_WRAP_KEY, stored);
  }
  const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromB64(b64s) {
  return Uint8Array.from(atob(b64s), (c) => c.charCodeAt(0));
}

/** Persist vault password for silent auto-unlock on this device only. */
export async function saveVaultCredential(userId, password) {
  if (!isInstalledClient() || !userId || !password) return;
  const key = await getDeviceWrapKey();
  if (!key) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(password),
  );
  localStorage.setItem(credStorageKey(userId), `${toB64(ct)}.${toB64(iv)}`);
}

/** Load vault password for auto-unlock; returns null if missing or corrupt. */
export async function loadVaultCredential(userId) {
  if (!isInstalledClient() || !userId || typeof localStorage === 'undefined') return null;
  const blob = localStorage.getItem(credStorageKey(userId));
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
    localStorage.removeItem(credStorageKey(userId));
    return null;
  }
}

export function clearVaultCredential(userId) {
  if (typeof localStorage === 'undefined' || !userId) return;
  localStorage.removeItem(credStorageKey(userId));
}

export function clearAllVaultCredentials() {
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k?.startsWith('ssc_vault_wrap_')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}