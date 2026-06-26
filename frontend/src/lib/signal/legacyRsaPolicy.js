import { isInstalledClient } from '../platform';

/** Installed apps may decrypt legacy RSA inbound traffic but must not send new RSA ciphertext. */
export function maySendLegacyRsa() {
  return !isInstalledClient();
}