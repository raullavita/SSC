/**
 * Dev-only group E2EE fallback when libsignal is unavailable (browser/CRA tests).
 * Not used in installed production clients — Step 4 removes this path from prod builds.
 */

import { ensureOwnSenderKey, getSenderKey } from './senderKeyStore';

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

export async function devEncryptGroupMessage(plaintext, { groupId, userId } = {}) {
  const keyMaterial = ensureOwnSenderKey(groupId, userId);
  const ciphertext = await xorCombine(plaintext, keyMaterial);
  return { ciphertext, protocol: 'group_sender_key_dev' };
}

export async function devDecryptGroupMessage(ciphertext, { groupId, senderId } = {}) {
  const keyMaterial = getSenderKey(groupId, senderId);
  if (!keyMaterial) return '[Unable to decrypt — sender key not received yet]';
  try {
    return await xorUncombine(ciphertext, keyMaterial);
  } catch (err) {
    return `[Group decrypt failed: ${err?.message || 'corrupt_ciphertext'}]`;
  }
}