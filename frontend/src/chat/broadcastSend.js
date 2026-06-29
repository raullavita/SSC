/** Fan-out a text message to broadcast list recipients as individual 1:1 E2E messages — Q.30 */

import { api } from '../lib/api';
import { findDmConversation } from '../lib/broadcastLists';
import { sendForwardToConversation } from './forwardMessageSend';
import { isPeerBlocked } from '../lib/contactFilters';

export async function resolveOrCreateDmConversation({
  recipientUserId,
  contacts,
  conversations,
  loadConversations,
}) {
  const existing = findDmConversation(conversations, recipientUserId);
  if (existing) return existing;

  const contact = contacts.find((c) => c.user_id === recipientUserId);
  if (!contact?.username) {
    const err = new Error('contact_not_found');
    throw err;
  }

  const { data } = await api.post('/conversations', { peer_username: contact.username });
  if (loadConversations) await loadConversations();
  return data;
}

export async function sendBroadcastText({
  text,
  recipientIds,
  user,
  privateKey,
  refreshUser,
  contacts,
  conversations,
  loadConversations,
}) {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('empty_message');
  if (!recipientIds?.length) throw new Error('no_recipients');

  let sent = 0;
  const errors = [];
  let convSnapshot = [...(conversations || [])];

  for (const recipientId of recipientIds) {
    if (isPeerBlocked(recipientId, contacts)) {
      errors.push({ recipientId, error: new Error('blocked') });
      continue;
    }
    try {
      const conv = await resolveOrCreateDmConversation({
        recipientUserId: recipientId,
        contacts,
        conversations: convSnapshot,
        loadConversations,
      });
      if (!findDmConversation(convSnapshot, recipientId)) {
        convSnapshot = [...convSnapshot, conv];
      }
      await sendForwardToConversation({
        text: trimmed,
        forwardedFromMessageId: undefined,
        targetConv: conv,
        user,
        privateKey,
        refreshUser,
      });
      sent += 1;
    } catch (error) {
      errors.push({ recipientId, error });
    }
  }

  return { sent, errors, total: recipientIds.length };
}