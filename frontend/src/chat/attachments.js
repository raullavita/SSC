/**
 * Encrypted file/voice attachment messages — signal_v1_attachment — Engine 8/12.
 */

import { api } from '../lib/api';
import { encryptMessage } from '../signal/signalBridge';

const ATTACHMENT_PROTOCOL = 'signal_v1_attachment';

export async function sendAttachmentMessage(
  conversationId,
  { fileId, mime, name, size, peerId }
) {
  const payload = JSON.stringify({
    type: 'attachment',
    file_id: fileId,
    mime: mime || 'application/octet-stream',
    name: name || 'file',
    size: size || 0,
  });
  const { ciphertext } = await encryptMessage(payload, { peerId });
  return api.post(`/api/conversations/${conversationId}/messages`, {
    ciphertext,
    protocol: ATTACHMENT_PROTOCOL,
  });
}

export function parseAttachmentText(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'attachment' && data?.file_id) return data;
  } catch {
    /* not an attachment */
  }
  return null;
}

export function isVoiceAttachment(attachment) {
  const mime = attachment?.mime || '';
  return mime.startsWith('audio/');
}

export function isImageAttachment(attachment) {
  const mime = attachment?.mime || '';
  return mime.startsWith('image/');
}