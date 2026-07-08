/**
 * Send one encrypted message to every recipient in a broadcast list.
 */

import { api } from './api';
import { getSealedSenderEnabled } from './chatPrefs';
import { encryptMessage, encryptSealedMessage } from '../signal/signalBridge';

export async function sendBroadcastMessage({ text, recipientIds, disappearingSeconds }) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error('broadcast_message_empty');
  }
  if (!recipientIds?.length) {
    throw new Error('broadcast_list_needs_recipients');
  }

  const results = [];
  const errors = [];

  for (const recipientId of recipientIds) {
    try {
      const convData = await api.post('/api/conversations', {
        participant_id: recipientId,
      });
      const conversationId = convData.conversation?.id;
      if (!conversationId) {
        throw new Error('conversation_create_failed');
      }

      let ciphertext;
      let protocol;
      let sealed = false;
      if (getSealedSenderEnabled()) {
        ({ ciphertext, protocol, sealed } = await encryptSealedMessage(trimmed, {
          peerId: recipientId,
        }));
      } else {
        ({ ciphertext, protocol } = await encryptMessage(trimmed, { peerId: recipientId }));
      }

      const body = { ciphertext, protocol };
      if (sealed) body.sealed = true;
      if (disappearingSeconds) body.disappearing_seconds = disappearingSeconds;

      await api.post(`/api/conversations/${conversationId}/messages`, body);
      results.push({ recipientId, conversationId });
    } catch (err) {
      errors.push({ recipientId, error: err.message || 'send_failed' });
    }
  }

  if (!results.length) {
    const detail = errors.map((e) => `${e.recipientId}: ${e.error}`).join('; ');
    throw new Error(detail || 'broadcast_send_failed');
  }

  return {
    sent: results.length,
    failed: errors.length,
    results,
    errors,
  };
}