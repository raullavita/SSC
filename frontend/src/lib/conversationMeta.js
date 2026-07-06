/** Metadata fields returned by GET/PATCH conversation endpoints. */
const CONVERSATION_META_FIELDS = [
  'pinned',
  'muted',
  'unread_count',
  'privacy',
  'updated_at',
  'type',
  'peer_id',
  'group_id',
];

function pickConversationMeta(conversation) {
  if (!conversation) return null;
  const out = { id: conversation.id };
  for (const key of CONVERSATION_META_FIELDS) {
    if (conversation[key] !== undefined) {
      out[key] = conversation[key];
    }
  }
  return out;
}

export function mergeConversationMeta(base, patch) {
  if (!base && !patch) return null;
  if (!base) return patch ? { ...patch } : null;
  if (!patch) return { ...base };
  return { ...base, ...pickConversationMeta(patch) };
}

export function patchConversationInList(conversations, patch) {
  if (!patch?.id) return conversations;
  const exists = conversations.some((entry) => entry.id === patch.id);
  if (!exists) return conversations;
  return conversations.map((entry) =>
    entry.id === patch.id ? mergeConversationMeta(entry, patch) : entry
  );
}

export function bumpUnread(conversation, { updatedAt } = {}) {
  if (!conversation) return conversation;
  return {
    ...conversation,
    unread_count: Number(conversation.unread_count || 0) + 1,
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };
}

