/**
 * Client-only last-message previews (never from server — E2E / metadata policy).
 * Updated when messages are decrypted/indexed locally.
 */

const store = new Map();

export function setConversationPreview(conversationId, { text, at, kind = 'text' } = {}) {
  if (!conversationId) return;
  const atMs = at ? new Date(at).getTime() : Date.now();
  if (Number.isNaN(atMs)) return;
  const prev = store.get(conversationId);
  if (prev && prev.atMs > atMs) return;

  let label = '';
  if (kind === 'attachment') label = 'Attachment';
  else if (kind === 'poll') label = 'Poll';
  else if (kind === 'voice') label = 'Voice message';
  else label = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  if (!label && kind === 'text') return;

  store.set(conversationId, {
    text: label || 'Message',
    atMs,
    kind,
  });
}

export function getConversationPreview(conversationId) {
  return store.get(conversationId) || null;
}

export function formatPreviewLine(preview) {
  if (!preview?.text) return '';
  return preview.text;
}
