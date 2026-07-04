/**
 * Group E2EE — Signal Sender Keys scaffold.
 * Production: distribute sender keys per member via prekey infrastructure.
 * Dev: shared envelope keyed by group_id until libsignal group sessions ship.
 */

import { encryptMessage, decryptMessage } from './signalBridge';

export async function encryptGroupMessage(plaintext, { groupId, peerId } = {}) {
  const keyId = groupId || peerId;
  if (!keyId) {
    throw new Error('group_id_required');
  }
  return encryptMessage(plaintext, { peerId: keyId });
}

export async function decryptGroupMessage(ciphertext, { groupId, senderId } = {}) {
  const keyId = groupId || senderId;
  return decryptMessage(ciphertext, { peerId: senderId || keyId });
}

export function groupE2EStatus() {
  return {
    mode: 'dev_group_envelope',
    senderKeys: false,
    note: 'Full Signal Sender Keys distribution is planned; groups use dev envelope today.',
  };
}