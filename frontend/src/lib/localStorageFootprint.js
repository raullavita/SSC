/**
 * localStorage footprint — Engine 3 Steps 3.4 + 3.6.
 * Panic removes peer verification metadata; normal logout preserves it.
 * JWT (ssc_token) is not stored after Engine 5.4 — only purged if legacy remains.
 */
import { purgeVerificationStorageOnPanic } from './verification';
import { LEGACY_JWT_KEY } from './sessionConstants';

export const SESSION_SECRET_KEYS = ['ssc_native_push_token'];

/** Legacy keys removed on panic/logout — never written after Engine 5.4. */
export const LEGACY_JWT_PURGE_KEYS = [LEGACY_JWT_KEY];

/** Remove push tokens and any legacy JWT — panic and logout. */
export function clearLocalStorageSessionSecrets() {
  if (typeof localStorage === 'undefined') return;
  for (const key of [...SESSION_SECRET_KEYS, ...LEGACY_JWT_PURGE_KEYS]) {
    localStorage.removeItem(key);
  }
}

/**
 * Apply panic-only localStorage rules before redirect or server round-trip.
 * @param {'logout'|'panic'} reason
 */
export function applyLocalStoragePanicPolicy(reason) {
  if (reason !== 'panic' || typeof localStorage === 'undefined') return;
  purgeVerificationStorageOnPanic();
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith('ssc_onboarding_v1_')) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}