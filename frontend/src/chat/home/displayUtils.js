/** Display helpers for chat list / thread titles. */

export function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getThreadTitle(active, { isGroup, nameForId, userId } = {}) {
  if (!active) return '';
  if (isGroup) return `Group ${active.group_id || active.id}`;
  if (active.peer_id && nameForId) {
    const label = nameForId(active.peer_id, userId);
    if (label && label !== active.peer_id.slice(0, 10)) return label;
  }
  return active.peer_id;
}

export function conversationLabel(conversation) {
  if (!conversation) return '';
  if (conversation.type === 'group') {
    return String(conversation.group_id || conversation.id);
  }
  return String(conversation.peer_id || conversation.id);
}

/** Stable hue 0–359 for avatar backgrounds from an id string. */
export function avatarHue(id) {
  const s = String(id || 'x');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33 + s.charCodeAt(i)) % 360;
  }
  return h;
}

export function sortConversations(conversations) {
  return [...conversations].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return tb - ta;
  });
}

export function filterConversations(conversations, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return conversations;
  return conversations.filter((c) => conversationLabel(c).toLowerCase().includes(q));
}
