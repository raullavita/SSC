/**
 * Client-side in-chat message search (decrypted plaintext only) — Q.14.
 */
import { isMessageDeleted } from './messageDelete';

export function resolveSenderUsername(message, context = {}) {
  const { user, peer, isGroup, activeConv } = context;
  if (message.sender_id === user?.user_id) return user?.username || '';
  if (isGroup && activeConv?.members) {
    return activeConv.members.find((m) => m.user_id === message.sender_id)?.username || '';
  }
  return peer?.username || '';
}

export function messageMatchesQuery(message, query, decryptedBodies, context = {}) {
  if (isMessageDeleted(message)) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const sender = resolveSenderUsername(message, context).toLowerCase();
  if (sender.includes(q)) return true;
  const body = decryptedBodies?.[message.message_id];
  return Boolean(body && body.toLowerCase().includes(q));
}

export function filterMessagesForSearch(messages, query, decryptedBodies, context = {}) {
  const q = query.trim();
  if (!q) return messages;
  return messages.filter((m) => messageMatchesQuery(m, q, decryptedBodies, context));
}

export function searchMatchIds(messages, query, decryptedBodies, context = {}) {
  return filterMessagesForSearch(messages, query, decryptedBodies, context).map((m) => m.message_id);
}

export function splitTextForHighlight(text, query) {
  if (!text) return [{ text: '', match: false }];
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts = [];
  let start = 0;
  let idx = lower.indexOf(qLower, start);
  while (idx !== -1) {
    if (idx > start) parts.push({ text: text.slice(start, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    start = idx + q.length;
    idx = lower.indexOf(qLower, start);
  }
  if (start < text.length) parts.push({ text: text.slice(start), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

export function clampSearchMatchIndex(index, matchCount) {
  if (matchCount <= 0) return 0;
  const normalized = Number.isFinite(index) ? index : 0;
  return ((normalized % matchCount) + matchCount) % matchCount;
}