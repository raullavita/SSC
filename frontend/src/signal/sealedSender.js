/**
 * Sealed sender helpers — Engine 9.
 * Hides sender identity from recipients; server stores sender_id for delivery/TTL only.
 */

import { encryptMessage } from './signalBridge';
import { SIGNAL_PROTOCOL_V1 } from './envelope';

export async function encryptSealedMessage(plaintext, { peerId, deviceId } = {}) {
  const { ciphertext } = await encryptMessage(plaintext, { peerId, deviceId });
  return {
    ciphertext,
    protocol: `${SIGNAL_PROTOCOL_V1}_sealed`,
    sealed: true,
  };
}