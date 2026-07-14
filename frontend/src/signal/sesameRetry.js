/**
 * Sesame session healing — decrypt retry requests and resend.
 */

import { api } from '../lib/api';
import { getMessageRecord, deleteMessageRecord } from './messageRecords';
import { encryptMessageForRecipients } from './signalBridge';

const MAX_LOCAL_RETRIES = 3;
const retryInFlight = new Set();

export async function requestDecryptRetry({ messageId, conversationId, requesterDeviceId }) {
  return api.post('/api/messages/retry-request', {
    message_id: messageId,
    conversation_id: conversationId,
    requester_device_id: requesterDeviceId,
  });
}

export async function handleDecryptRetryRequest(payload, { localUserId, localDeviceId }) {
  const messageId = payload?.message_id;
  const conversationId = payload?.conversation_id;
  const requesterId = payload?.requester_id;
  const requesterDeviceId = payload?.requester_device_id;
  if (!messageId || !conversationId || !requesterId) return null;

  const key = `${messageId}:${requesterId}:${requesterDeviceId || ''}`;
  if (retryInFlight.has(key)) return null;
  retryInFlight.add(key);

  try {
    const record = getMessageRecord(messageId);
    if (!record?.plaintext) return null;

    const { device_ciphertexts, protocol } = await encryptMessageForRecipients(
      record.plaintext,
      {
        peerId: requesterId,
        localUserId,
        localDeviceId,
        includeSelfDevices: false,
        targetDeviceIds: requesterDeviceId ? [requesterDeviceId] : undefined,
      }
    );

    const data = await api.post(`/api/messages/${messageId}/resend-ciphertext`, {
      device_ciphertexts,
      protocol,
      target_device_id: requesterDeviceId || undefined,
    });
    deleteMessageRecord(messageId);
    return data.message;
  } finally {
    retryInFlight.delete(key);
  }
}

export async function decryptWithRetry(message, { peerId, localDeviceId, conversationId }) {
  const { decryptMessage } = await import('./signalBridge');
  try {
    return await decryptMessage(resolveCiphertext(message, localDeviceId), { peerId });
  } catch (err) {
    if (!conversationId || !message?.id) throw err;
    let lastErr = err;
    for (let attempt = 0; attempt < MAX_LOCAL_RETRIES; attempt += 1) {
      try {
        await requestDecryptRetry({
          messageId: message.id,
          conversationId,
          requesterDeviceId: localDeviceId,
        });
        await sleep(1200 + attempt * 800);
        const refreshed = await api.get(`/api/conversations/${conversationId}/messages`);
        const updated = (refreshed.messages || []).find((m) => m.id === message.id);
        if (updated) {
          return await decryptMessage(resolveCiphertext(updated, localDeviceId), { peerId });
        }
      } catch (retryErr) {
        lastErr = retryErr;
      }
    }
    throw lastErr;
  }
}

export function resolveCiphertext(message, localDeviceId) {
  if (!message) return '';
  const map = message.device_ciphertexts;
  if (map && localDeviceId && map[localDeviceId]) {
    return map[localDeviceId];
  }
  if (map && typeof map === 'object') {
    const first = Object.values(map)[0];
    if (first) return first;
  }
  return message.ciphertext || '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}