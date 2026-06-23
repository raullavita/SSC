/**
 * Vault policy — Engine 2 Step 2.2.
 * Decrypted private keys live in memory only for the current page session.
 * Never persist to sessionStorage, localStorage, or IndexedDB.
 */

export const LEGACY_SESSION_PK_KEYS = ['ssc_pk_jwk', 'ssc_pk_unlocked'];

/** Remove legacy sessionStorage keys from builds before 2.2. */
export function purgeLegacyPrivateKeyFromSession() {
  if (typeof sessionStorage === 'undefined') return;
  for (const key of LEGACY_SESSION_PK_KEYS) {
    sessionStorage.removeItem(key);
  }
}