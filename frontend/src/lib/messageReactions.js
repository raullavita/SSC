/** Message reactions — Q.11 */

import { isMessageDeleted } from './messageDelete';

export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function canReactToMessage(msg) {
  return Boolean(msg) && !isMessageDeleted(msg);
}

export function myReactionForMessage(reactions, userId) {
  if (!userId || !Array.isArray(reactions)) return null;
  const mine = reactions.find((r) => r.user_id === userId);
  return mine?.emoji || null;
}

export function groupReactionsForDisplay(reactions = [], userId) {
  const map = new Map();
  for (const row of reactions) {
    const emoji = row.emoji;
    if (!map.has(emoji)) {
      map.set(emoji, { emoji, count: 0, mine: false });
    }
    const entry = map.get(emoji);
    entry.count += 1;
    if (row.user_id === userId) entry.mine = true;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export function applyMessageReactionUpdate(messages, payload) {
  const messageId = payload?.message_id;
  if (!messageId || !Array.isArray(messages)) return messages;
  const reactions = payload.reactions || [];
  return messages.map((m) => (
    m.message_id === messageId ? { ...m, reactions } : m
  ));
}

export function isAllowedReaction(emoji) {
  return ALLOWED_REACTIONS.includes(emoji);
}