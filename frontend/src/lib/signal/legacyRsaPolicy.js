import { isInstalledClient } from '../platform';

/**
 * Q.54 — Installed clients are decrypt-only for legacy RSA during migration.
 * Browser/PWA may still send legacy_rsa when Signal is unavailable.
 */
export function maySendLegacyRsa() {
  return !isInstalledClient();
}

/** Dual-read window: all clients may decrypt inbound legacy_rsa ciphertext. */
export function canDecryptLegacyRsa() {
  return true;
}