/** Reply / quote helpers — Q.7 (metadata id + client-side preview). */

const PREVIEW_MAX = 140;

export function findMessageById(messages, messageId) {
  if (!messageId || !Array.isArray(messages)) return null;
  return messages.find((m) => m.message_id === messageId) || null;
}

export function senderLabelForMessage(msg, { user, peer, members = [], isGroup = false }) {
  if (!msg) return '';
  if (msg.sender_id === user?.user_id) return user?.username || 'you';
  if (isGroup) {
    const member = members.find((m) => m.user_id === msg.sender_id);
    return member?.username || 'member';
  }
  return peer?.username || 'contact';
}

export function messagePreviewText(msg, plaintext, t) {
  if (!msg) return t('replyUnavailable');
  switch (msg.message_type) {
    case 'voice':
      return t('replyPreviewVoice');
    case 'image':
      return t('replyPreviewImage');
    case 'file':
      return t('replyPreviewFile');
    case 'video':
      return t('replyPreviewVideo');
    default: {
      const text = (plaintext || '').trim();
      if (!text) return t('replyPreviewEmpty');
      return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text;
    }
  }
}

export function buildQuotePreview(msg, plaintext, context, t) {
  if (!msg) {
    return { author: '', preview: t('replyUnavailable') };
  }
  return {
    author: senderLabelForMessage(msg, context),
    preview: messagePreviewText(msg, plaintext, t),
    messageId: msg.message_id,
  };
}