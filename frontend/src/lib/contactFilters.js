/**
 * Contact-aware conversation filtering for block/mute UX.
 */

export function blockedContactIds(contacts = []) {
  return new Set(
    contacts.filter((c) => c.blocked).map((c) => c.user_id),
  );
}

export function mutedContactIds(contacts = []) {
  return new Set(
    contacts.filter((c) => c.muted).map((c) => c.user_id),
  );
}

/** Hide 1:1 threads with blocked peers; groups always visible. */
export function visibleConversations(conversations = [], contacts = []) {
  const blocked = blockedContactIds(contacts);
  return conversations.filter((c) => {
    if (c.is_group) return true;
    const peerId = c.peer?.user_id;
    if (!peerId) return true;
    return !blocked.has(peerId);
  });
}

export function isPeerBlocked(peerUserId, contacts = []) {
  if (!peerUserId) return false;
  return contacts.some((c) => c.user_id === peerUserId && c.blocked);
}

export function isPeerMuted(peerUserId, contacts = []) {
  if (!peerUserId) return false;
  return contacts.some((c) => c.user_id === peerUserId && c.muted);
}

export function isConversationMuted(conversation, contacts = []) {
  if (!conversation) return false;
  if (conversation.muted) return true;
  if (!conversation.is_group && conversation.peer?.user_id) {
    return isPeerMuted(conversation.peer.user_id, contacts);
  }
  return false;
}