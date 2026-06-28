/** Delete for everyone / unsend — Q.8 */

export function isMessageDeleted(msg) {
  if (!msg) return false;
  return msg.message_type === 'deleted' || Boolean(msg.deleted_for_everyone_at);
}

export function canUnsendMessage(msg, userId) {
  if (!msg || !userId) return false;
  if (isMessageDeleted(msg)) return false;
  if (msg.sender_id !== userId) return false;
  if (msg.expires_at) {
    const exp = new Date(msg.expires_at);
    if (Number.isFinite(exp.getTime()) && exp <= new Date()) return false;
  }
  return true;
}

export function applyMessageDeleted(messages, { message_id: messageId, deleted_at: deletedAt }) {
  if (!messageId || !Array.isArray(messages)) return messages;
  return messages.map((m) => {
    if (m.message_id !== messageId) return m;
    return {
      ...m,
      message_type: 'deleted',
      deleted_for_everyone_at: deletedAt || new Date().toISOString(),
      ciphertext: '',
      iv: null,
      encrypted_keys: {},
      signal_message_type: null,
      distribution_id: null,
      attachment_id: null,
      attachment_iv: null,
      attachment_encrypted_keys: null,
      attachment_content_type: null,
    };
  });
}