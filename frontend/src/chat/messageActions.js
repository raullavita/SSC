/**
 * Message lifecycle actions — edit, delete, forward — Step 12.
 */

import { api } from '../lib/api';
import { getSealedSenderEnabled } from '../lib/chatPrefs';
import { encryptGroupMessage } from '../signal/groupSenderKeys';
import { encryptSealedMessage } from '../signal/sealedSender';
import { encryptMessage } from '../signal/signalBridge';

async function encryptPlaintext(text, { peerId, isGroup, groupId, userId, memberIds, conversationId }) {
  if (isGroup) {
    return encryptGroupMessage(text, { groupId, userId, conversationId, memberIds });
  }
  if (getSealedSenderEnabled()) {
    return encryptSealedMessage(text, { peerId });
  }
  return encryptMessage(text, { peerId });
}

export async function editMessageApi(messageId, text, encryptCtx) {
  const { ciphertext, protocol } = await encryptPlaintext(text.trim(), encryptCtx);
  const sealed = Boolean(encryptCtx.sealed);
  const body = { ciphertext, protocol };
  if (sealed) body.sealed = true;
  return api.patch(`/api/messages/${messageId}`, body);
}

export async function deleteMessageApi(messageId, scope = 'me') {
  return api.delete(`/api/messages/${messageId}?scope=${encodeURIComponent(scope)}`);
}

export async function forwardMessageApi(
  text,
  { sourceMessageId, conversationId, peerId, isGroup, groupId, userId, memberIds }
) {
  const { ciphertext, protocol, sealed } = await encryptPlaintext(text.trim(), {
    peerId,
    isGroup,
    groupId,
    userId,
    memberIds,
    conversationId,
  });
  const body = { ciphertext, protocol, forwarded_from: sourceMessageId };
  if (sealed) body.sealed = true;
  return api.post(`/api/conversations/${conversationId}/messages`, body);
}

export function canEditMessage(message, userId) {
  if (!message || message.message_kind === 'deleted') return false;
  if (message.sender_id !== userId) return false;
  if (message.message_kind && message.message_kind !== 'message') return false;
  if (!message.text) return false;
  const created = new Date(message.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= 15 * 60 * 1000;
}

export function canDeleteForEveryone(message, userId) {
  if (!message || message.message_kind === 'deleted') return false;
  if (message.sender_id !== userId) return false;
  const created = new Date(message.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= 60 * 60 * 1000;
}