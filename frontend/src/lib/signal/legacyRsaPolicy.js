/**
 * Q.54 — Legacy RSA send retired everywhere. Installed clients decrypt-only during migration.
 */
export function maySendLegacyRsa() {
  return false;
}

/** Dual-read window: all clients may decrypt inbound legacy_rsa ciphertext. */
export function canDecryptLegacyRsa() {
  return true;
}