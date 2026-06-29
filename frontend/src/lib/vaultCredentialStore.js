/**
 * Device-bound vault unlock credential — invisible to users (TASK A).
 * Stores password wrapped with a per-device AES key (never the RSA private key).
 * Cleared on logout / panic wipe.
 */
import { isInstalledClient } from './platform';
import { wrapDeviceSecret, unwrapDeviceSecret } from './deviceWrapCrypto';

const credStorageKey = (userId) => `ssc_vault_wrap_${userId}`;

/** Persist vault password for silent auto-unlock on this device only. */
export async function saveVaultCredential(userId, password) {
  if (!isInstalledClient() || !userId || !password || typeof localStorage === 'undefined') return;
  const blob = await wrapDeviceSecret(password);
  // codeql[js/clear-text-storage-of-sensitive-information]: AES-GCM ciphertext only — vault password never stored plaintext
  if (blob) localStorage.setItem(credStorageKey(userId), blob);
}

/** Load vault password for auto-unlock; returns null if missing or corrupt. */
export async function loadVaultCredential(userId) {
  if (!isInstalledClient() || !userId || typeof localStorage === 'undefined') return null;
  const blob = localStorage.getItem(credStorageKey(userId));
  if (!blob) return null;
  const password = await unwrapDeviceSecret(blob);
  if (!password) {
    localStorage.removeItem(credStorageKey(userId));
    return null;
  }
  return password;
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