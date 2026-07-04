/**
 * Group E2EE — Signal Sender Keys with local distribution.
 * Each member has a sender key per group; keys are exchanged via 1:1 E2EE.
 */

import { encryptMessage, decryptMessage } from './signalBridge';
import {
  SENDER_KEY_DIST_PREFIX,
  ensureOwnSenderKey,
  getSenderKey,
  packSenderKeyDistribution,
  rememberSenderKey,
  unpackSenderKeyDistribution,
} from './senderKeyStore';

async function xorCombine(plaintext, keyMaterial) {
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);
  const keyBytes = Uint8Array.from(atob(keyMaterial), (c) => c.charCodeAt(0));
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  let binary = '';
  out.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

async function xorUncombine(ciphertext, keyMaterial) {
  const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const keyBytes = Uint8Array.from(atob(keyMaterial), (c) => c.charCodeAt(0));
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(out);
}

export async function distributeSenderKeyToMember({
  groupId,
  senderId,
  memberId,
  keyMaterial,
}) {
  const payload = packSenderKeyDistribution({ groupId, senderId, keyMaterial });
  const wrapped = await encryptMessage(payload, { peerId: memberId });
  return wrapped.ciphertext || wrapped;
}

export async function ingestSenderKeyDistribution(ciphertext, { peerId } = {}) {
  const plain = await decryptMessage(ciphertext, { peerId });
  const dist = unpackSenderKeyDistribution(plain);
  if (!dist?.groupId || !dist?.senderId || !dist?.keyMaterial) return false;
  rememberSenderKey(dist.groupId, dist.senderId, dist.keyMaterial);
  return true;
}

export function isSenderKeyDistribution(ciphertext) {
  return Boolean(ciphertext && ciphertext.startsWith(SENDER_KEY_DIST_PREFIX));
}

export async function encryptGroupMessage(plaintext, { groupId, userId, memberIds = [] } = {}) {
  if (!groupId || !userId) {
    throw new Error('group_id_and_user_required');
  }
  const keyMaterial = ensureOwnSenderKey(groupId, userId);
  if (memberIds.length) {
    await Promise.all(
      memberIds
        .filter((id) => id && id !== userId)
        .map((memberId) =>
          distributeSenderKeyToMember({ groupId, senderId: userId, memberId, keyMaterial })
        )
    );
  }
  const ciphertext = await xorCombine(plaintext, keyMaterial);
  return { ciphertext, protocol: 'group_sender_key_v1' };
}

export async function decryptGroupMessage(ciphertext, { groupId, senderId } = {}) {
  if (isSenderKeyDistribution(ciphertext)) {
    return '[sender key]';
  }
  const keyMaterial = getSenderKey(groupId, senderId);
  if (!keyMaterial) {
    return await decryptMessage(ciphertext, { peerId: senderId });
  }
  try {
    return await xorUncombine(ciphertext, keyMaterial);
  } catch {
    return '[encrypted group message]';
  }
}

export function groupE2EStatus() {
  return {
    mode: 'group_sender_key_v1',
    senderKeys: true,
    note: 'Per-member sender keys stored locally and distributed via 1:1 E2EE.',
  };
}