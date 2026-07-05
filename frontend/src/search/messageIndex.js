/**
 * Local message search — minisearch on decrypted client index only (Engine 12).
 * @see https://github.com/lucaong/minisearch
 */

import MiniSearch from 'minisearch';

const indexes = new Map();

function getIndex(conversationId) {
  if (!indexes.has(conversationId)) {
    indexes.set(
      conversationId,
      new MiniSearch({
        fields: ['text'],
        storeFields: ['id', 'text', 'sender_id', 'created_at'],
        searchOptions: { boost: { text: 2 }, prefix: true, fuzzy: 0.2 },
      })
    );
  }
  return indexes.get(conversationId);
}

export function indexMessage(conversationId, message) {
  if (!conversationId || !message?.id || !message?.text) return;
  const idx = getIndex(conversationId);
  try {
    idx.add({
      id: message.id,
      text: message.text,
      sender_id: message.sender_id,
      created_at: message.created_at,
    });
  } catch {
    idx.discard(message.id);
    idx.add({
      id: message.id,
      text: message.text,
      sender_id: message.sender_id,
      created_at: message.created_at,
    });
  }
}

export function indexMessages(conversationId, messages) {
  const idx = getIndex(conversationId);
  idx.removeAll();
  for (const m of messages) {
    if (m?.id && m?.text) {
      idx.add({
        id: m.id,
        text: m.text,
        sender_id: m.sender_id,
        created_at: m.created_at,
      });
    }
  }
}

export function searchMessages(conversationId, query, { limit = 20 } = {}) {
  if (!query?.trim()) return [];
  const idx = getIndex(conversationId);
  return idx.search(query.trim()).slice(0, limit);
}

export function removeMessageFromIndex(conversationId, messageId) {
  if (!conversationId || !messageId) return;
  const idx = indexes.get(conversationId);
  if (!idx) return;
  try {
    idx.discard(messageId);
  } catch {
    // not indexed
  }
}

export function clearIndex(conversationId) {
  indexes.delete(conversationId);
}

export function clearAllIndexes() {
  indexes.clear();
}