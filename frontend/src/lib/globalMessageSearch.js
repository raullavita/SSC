/**
 * Global message search — Q.15 (client-side decrypt cache, retention via API).
 */
import { SKDM_MESSAGE_TYPE } from './signal/constants';
import { STATUS_SKDM_MESSAGE_TYPE } from './signal/statuses';
import { filterMessagesForSearch } from './chatSearch';

export const MIN_GLOBAL_SEARCH_LENGTH = 2;
export const MAX_GLOBAL_SEARCH_RESULTS = 50;
export const GLOBAL_SEARCH_CONCURRENCY = 4;

export function filterVisibleChatMessages(messages = []) {
  return messages.filter(
    (msg) => msg?.message_type !== SKDM_MESSAGE_TYPE
      && msg?.message_type !== STATUS_SKDM_MESSAGE_TYPE,
  );
}

export function buildSearchSnippet(body, query, maxLen = 96) {
  if (!body) return '';
  const q = query.trim();
  if (!q) return body.slice(0, maxLen);
  const lower = body.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return body.slice(0, maxLen);
  const pad = Math.floor((maxLen - q.length) / 2);
  let start = Math.max(0, idx - pad);
  let end = Math.min(body.length, start + maxLen);
  if (end - start < maxLen) start = Math.max(0, end - maxLen);
  let snippet = body.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < body.length) snippet = `${snippet}…`;
  return snippet;
}

export function conversationSearchTitle(conversation, formatGroupLabel, t) {
  if (conversation?.is_group) {
    return formatGroupLabel?.(conversation) || conversation.display_label || t('group');
  }
  const username = conversation?.peer?.username;
  return username ? `@${username}` : t('group');
}

export function searchGlobalInConversation({
  conversation,
  messages,
  decryptedBodies,
  query,
  user,
}) {
  const context = {
    user,
    peer: conversation.peer,
    isGroup: conversation.is_group,
    activeConv: conversation,
  };
  const matches = filterMessagesForSearch(messages, query, decryptedBodies, context);
  return matches.map((msg) => ({
    message_id: msg.message_id,
    conversation_id: conversation.conversation_id,
    created_at: msg.created_at,
    sender_id: msg.sender_id,
    snippet: buildSearchSnippet(decryptedBodies[msg.message_id], query),
    conversation,
  }));
}

export function mergeGlobalSearchResults(resultLists, { limit = MAX_GLOBAL_SEARCH_RESULTS } = {}) {
  return resultLists
    .flat()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, limit);
}

export async function mapWithConcurrency(items, limit, mapper) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  }));
  return results;
}