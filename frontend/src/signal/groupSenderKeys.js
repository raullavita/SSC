/**
 * Group E2EE — libsignal sender keys (Step 2) with dev fallback for CRA tests.
 */

import { api } from '../lib/api';
import {
  assertGroupLibsignalRuntime,
  requiresProductionCrypto,
} from '../lib/cryptoPolicy';
import {
  GROUP_SENDER_KEY_DIST_PROTOCOL,
  GROUP_SENDER_KEY_PROTOCOL,
  LEGACY_SENDER_KEY_DIST_PREFIX,
  configureGroupKeys,
  createDistributionMessage,
  decryptGroupCiphertext,
  encryptGroupPlaintext,
  getDistributionState,
  isLibsignalGroupAvailable,
  markDistributionSent,
  processDistribution,
} from './groupSenderKeyBridge';
import {
  devDecryptGroupMessage,
  devEncryptGroupMessage,
} from './groupSenderKeysDev';
import {
  packSenderKeyDistribution,
  rememberSenderKey,
  unpackSenderKeyDistribution,
} from './senderKeyStore';

export function isSenderKeyDistributionMessage(message) {
  if (!message) return false;
  if (message.protocol === GROUP_SENDER_KEY_DIST_PROTOCOL) return true;
  return Boolean(message.ciphertext?.startsWith(LEGACY_SENDER_KEY_DIST_PREFIX));
}

function isSenderKeyDistribution(ciphertext) {
  return Boolean(ciphertext && ciphertext.startsWith(LEGACY_SENDER_KEY_DIST_PREFIX));
}

async function postDistributionMessage(conversationId, ciphertext) {
  if (!conversationId || !ciphertext) return;
  await api.post(`/api/conversations/${conversationId}/messages`, {
    ciphertext,
    protocol: GROUP_SENDER_KEY_DIST_PROTOCOL,
  });
}

export async function ingestSenderKeyDistribution(
  ciphertext,
  { peerId, deviceId = '1', protocol } = {}
) {
  if (protocol === GROUP_SENDER_KEY_DIST_PROTOCOL) {
    if (!isLibsignalGroupAvailable()) return false;
    await processDistribution({ senderId: peerId, deviceId, ciphertext });
    return true;
  }

  if (ciphertext?.startsWith(LEGACY_SENDER_KEY_DIST_PREFIX)) {
    const { decryptMessage } = await import('./signalBridge');
    const plain = await decryptMessage(ciphertext, { peerId });
    const dist = unpackSenderKeyDistribution(plain);
    if (!dist?.groupId || !dist?.senderId || !dist?.keyMaterial) return false;
    rememberSenderKey(dist.groupId, dist.senderId, dist.keyMaterial);
    return true;
  }

  return false;
}

export async function encryptGroupMessage(
  plaintext,
  { groupId, userId, conversationId, deviceId = '1' } = {}
) {
  if (!groupId || !userId) {
    throw new Error('group_id_and_user_required');
  }

  if (isLibsignalGroupAvailable()) {
    await configureGroupKeys({ localUserId: userId, deviceId });
    const state = await getDistributionState(groupId);
    if (!state.distributed) {
      const dist = await createDistributionMessage(groupId);
      if (dist?.ciphertext) {
        await postDistributionMessage(conversationId, dist.ciphertext);
        await markDistributionSent(groupId);
      }
    }
    const ciphertext = await encryptGroupPlaintext(groupId, plaintext);
    return { ciphertext, protocol: GROUP_SENDER_KEY_PROTOCOL };
  }

  assertGroupLibsignalRuntime('encrypt_group');
  return devEncryptGroupMessage(plaintext, { groupId, userId });
}

export async function decryptGroupMessage(
  ciphertext,
  { groupId, senderId, protocol, deviceId = '1' } = {}
) {
  if (protocol === GROUP_SENDER_KEY_DIST_PROTOCOL) {
    return '[sender key]';
  }
  if (isSenderKeyDistribution(ciphertext)) {
    return '[sender key]';
  }

  if (protocol === GROUP_SENDER_KEY_PROTOCOL && isLibsignalGroupAvailable()) {
    try {
      return await decryptGroupCiphertext(senderId, ciphertext, { deviceId });
    } catch {
      return '[encrypted group message]';
    }
  }

  if (protocol === GROUP_SENDER_KEY_PROTOCOL || !protocol) {
    if (isLibsignalGroupAvailable()) {
      try {
        return await decryptGroupCiphertext(senderId, ciphertext, { deviceId });
      } catch {
        /* try dev/legacy below */
      }
    }
  }

  if (requiresProductionCrypto()) {
    throw new Error('libsignal_group_required:decrypt_group');
  }
  return devDecryptGroupMessage(ciphertext, { groupId, senderId });
}

export function groupE2EStatus() {
  if (isLibsignalGroupAvailable()) {
    return {
      mode: GROUP_SENDER_KEY_PROTOCOL,
      senderKeys: true,
      libsignal: true,
      note: 'Per-member libsignal sender keys with server-relayed distribution messages.',
    };
  }
  return {
    mode: 'group_sender_key_dev',
    senderKeys: true,
    libsignal: false,
    note: 'Dev XOR fallback — install Electron/Android client for real sender keys.',
  };
}

