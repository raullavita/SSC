/**
 * localStorage footprint — Engine 3 Steps 3.4 + 3.6.
 * Panic removes peer verification metadata; normal logout preserves it.
 */
import { purgeVerificationStorageOnPanic } from './verification';

export const SESSION_SECRET_KEYS = ['ssc_token', 'ssc_native_push_token'];

/** Remove JWT and push tokens — panic and logout. */
export function clearLocalStorageSessionSecrets() {
  if (typeof localStorage === 'undefined') return;
  for (const key of SESSION_SECRET_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Apply panic-only localStorage rules before redirect or server round-trip.
 * @param {'logout'|'panic'} reason
 */
export function applyLocalStoragePanicPolicy(reason) {
  if (reason !== 'panic') return;
  purgeVerificationStorageOnPanic();
}