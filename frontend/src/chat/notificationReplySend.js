/** Encrypt and POST a text message from notification inline-reply — Q.43 */

import { api } from '../lib/api';
import { encryptMessageForRecipients } from '../lib/crypto';
import { evaluateMessagingGate } from './messagingGate';
import { ProtocolVersion } from '../lib/signal/constants';
import { ensureGroupSenderKeysDistributed, encryptGroupText } from '../lib/signal/groupMessages';
import { encryptSignalText } from '../lib/signal/messages';
import { maySendLegacyRsa } from '../lib/signal/legacyRsaPolicy';
import { buildRecipientsForConversation } from './forwardMessageSend';

export async function fetchConversationById(conversationId) {
  const { data } = await api.get('/conversations');
  const list = Array.isArray(data) ? data : data?.conversations || [];
  return list.find((c) => c.conversation_id === conversationId) || null;
}

export async function sendTextToConversation({
  text,
  conversationId,
  user,
  privateKey,
  refreshUser,
}) {
  const targetConv = await fetchConversationById(conversationId);
  if (!targetConv) {
    throw new Error('conversation_not_found');
  }

  const isGroup = !!targetConv.is_group;
  const peer = targetConv.peer || null;

  const gate = await evaluateMessagingGate({
    isGroup,
    peer,
    user,
    members: targetConv.members || [],
    refreshUser,
  });
  if (!gate?.ok) {
    const err = new Error(gate?.reason || 'encryption_not_ready');
    err.gate = gate;
    throw err;
  }

  const base = {
    conversation_id: conversationId,
    message_type: 'text',
  };

  if (gate.useSignal && isGroup) {
    await ensureGroupSenderKeysDistributed({
      conversationId,
      members: targetConv.members || [],
      ourUserId: user.user_id,
    });
    const enc = await encryptGroupText(conversationId, user.user_id, text);
    const { data } = await api.post('/messages', {
      ...base,
      protocol: ProtocolVersion.SIGNAL_GROUP_V1,
      ciphertext: enc.ciphertext,
      signal_message_type: enc.signal_message_type,
      distribution_id: enc.distribution_id,
    });
    return data;
  }

  if (gate.useSignal && !isGroup) {
    const enc = await encryptSignalText(peer.user_id, user.user_id, text);
    const { data } = await api.post('/messages', {
      ...base,
      protocol: ProtocolVersion.SIGNAL_V1,
      ciphertext: enc.ciphertext,
      signal_message_type: enc.signal_message_type,
    });
    return data;
  }

  if (!maySendLegacyRsa() || !privateKey) {
    throw new Error('encryption_not_ready');
  }
  const recipients = buildRecipientsForConversation(targetConv, user);
  if (Object.keys(recipients).length < 2) {
    throw new Error('no_recipients');
  }
  const enc = await encryptMessageForRecipients(text, recipients);
  const { data } = await api.post('/messages', {
    ...base,
    protocol: ProtocolVersion.LEGACY_RSA,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    encrypted_keys: enc.encrypted_keys,
  });
  return data;
}