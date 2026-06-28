/** In-chat image media gallery — Q.19 */

import { isMessageDeleted } from './messageDelete';

export function isChatImageMessage(message) {
  return Boolean(
    message
    && message.message_type === 'image'
    && message.attachment_id
    && !isMessageDeleted(message),
  );
}

export function listChatImageMedia(messages) {
  return (messages || [])
    .filter(isChatImageMessage)
    .map((msg) => ({
      message_id: msg.message_id,
      attachment_id: msg.attachment_id,
      sender_id: msg.sender_id,
      created_at: msg.created_at,
      msg,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}