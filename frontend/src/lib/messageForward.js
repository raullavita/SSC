/** Forward message — Q.10 (text only, mutual contacts / groups). */

import { isMessageDeleted } from './messageDelete';
import { visibleConversations } from './contactFilters';
import { messagePreviewText } from './messageReply';

export function canForwardMessage(msg) {
  if (!msg) return false;
  if (isMessageDeleted(msg)) return false;
  if (msg.message_type !== 'text') return false;
  if (msg.attachment_id) return false;
  return true;
}

export function eligibleForwardTargets(conversations, myContacts, { excludeConversationId } = {}) {
  const visible = visibleConversations(conversations, myContacts);
  return visible.filter((c) => {
    if (excludeConversationId && c.conversation_id === excludeConversationId) return false;
    if (c.is_group) return true;
    const peerId = c.peer?.user_id;
    if (!peerId) return false;
    return myContacts.some((contact) => contact.user_id === peerId && !contact.blocked);
  });
}

export function buildForwardPreview(msg, plaintext, context, t) {
  return {
    preview: messagePreviewText(msg, plaintext, t),
    messageId: msg?.message_id,
  };
}

export function conversationForwardLabel(conv, t, formatGroupLabel) {
  if (!conv) return '';
  if (conv.is_group) return formatGroupLabel?.(conv) || t('group');
  return conv.peer?.username ? `@${conv.peer.username}` : t('contact');
}