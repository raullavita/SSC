/**
 * Sealed sender helpers — Engine 9.
 * Hides sender identity from recipients; server stores sender_id for delivery/TTL only.
 */

import { encryptMessage, encryptMessageForRecipients } from './signalBridge';
import { getLocalDeviceId } from '../lib/deviceLink';
import { SIGNAL_PROTOCOL_V1 } from './envelope';

export async function encryptSealedMessage(plaintext, { peerId, deviceId } = {}) {
  const { ciphertext } = await encryptMessage(plaintext, { peerId, deviceId });
  return {
    ciphertext,
    protocol: `${SIGNAL_PROTOCOL_V1}_sealed`,
    sealed: true,
  };
}

/** Sealed sender with per-device ciphertexts for linked devices. */
export async function encryptSealedMessageForRecipients(
  plaintext,
  { peerId, localUserId, localDeviceId = getLocalDeviceId(), includeSelfDevices = true } = {}
) {
  const encrypted = await encryptMessageForRecipients(plaintext, {
    peerId,
    localUserId,
    localDeviceId,
    includeSelfDevices,
  });
  return {
    ...encrypted,
    protocol: `${SIGNAL_PROTOCOL_V1}_sealed`,
    sealed: true,
  };
}