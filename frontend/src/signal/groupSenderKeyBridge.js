/**
 * Group sender key bridge — Electron libsignal IPC (Step 2).
 */

export const GROUP_SENDER_KEY_PROTOCOL = 'group_sender_key_v2';
export const GROUP_SENDER_KEY_DIST_PROTOCOL = 'group_sender_key_dist_v1';
/** @deprecated v1 XOR distribution prefix — ingest only for legacy rows */
export const LEGACY_SENDER_KEY_DIST_PREFIX = 'ssc-skd:';

function getCrypto() {
  if (typeof window !== 'undefined' && window.sscCrypto) {
    return window.sscCrypto;
  }
  return null;
}

export function isLibsignalGroupAvailable() {
  const crypto = getCrypto();
  return Boolean(
    crypto?.encryptGroupMessage &&
      crypto?.decryptGroupMessage &&
      crypto?.createGroupDistribution
  );
}

export async function configureGroupKeys({ localUserId, deviceId = '1' } = {}) {
  const crypto = getCrypto();
  if (!crypto?.configureGroupKeys) return { ok: false };
  await crypto.configure({ localUserId, deviceId });
  await crypto.configureGroupKeys({ localUserId, deviceId });
  return { ok: true };
}

export async function getDistributionState(groupId) {
  const crypto = getCrypto();
  if (!crypto?.getGroupDistributionState) {
    return { distributionId: null, distributed: false };
  }
  return crypto.getGroupDistributionState(groupId);
}

export async function createDistributionMessage(groupId) {
  const crypto = getCrypto();
  if (!crypto?.createGroupDistribution) return null;
  return crypto.createGroupDistribution(groupId);
}

export async function markDistributionSent(groupId) {
  const crypto = getCrypto();
  if (!crypto?.markGroupDistributionSent) return { ok: false };
  return crypto.markGroupDistributionSent(groupId);
}

export async function processDistribution({ senderId, deviceId = '1', ciphertext }) {
  const crypto = getCrypto();
  if (!crypto?.processGroupDistribution) return { ok: false };
  return crypto.processGroupDistribution({ senderId, deviceId, ciphertext });
}

export async function encryptGroupPlaintext(groupId, plaintext) {
  const crypto = getCrypto();
  if (!crypto?.encryptGroupMessage) {
    throw new Error('libsignal_group_unavailable');
  }
  const result = await crypto.encryptGroupMessage(groupId, plaintext);
  return result.ciphertext;
}

export async function decryptGroupCiphertext(senderId, ciphertext, { deviceId = '1' } = {}) {
  const crypto = getCrypto();
  if (!crypto?.decryptGroupMessage) {
    throw new Error('libsignal_group_unavailable');
  }
  const result = await crypto.decryptGroupMessage(senderId, deviceId, ciphertext);
  return result.plaintext;
}