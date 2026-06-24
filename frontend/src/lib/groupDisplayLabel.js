/**
 * Client-side group titles — derived from member usernames (not stored on server).
 */
import { getLocalGroupLabel } from './groupLabels';

export function formatGroupMemberLabel(members = [], { maxShown = 2 } = {}) {
  const names = [...(members || [])]
    .map((m) => m?.username)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return 'Group';
  if (names.length <= maxShown) {
    return names.map((n) => `@${n}`).join(', ');
  }
  const shown = names.slice(0, maxShown).map((n) => `@${n}`).join(', ');
  const extra = names.length - maxShown;
  return `${shown} +${extra}`;
}

/** Sidebar / header label for a group conversation. */
export function formatGroupConversationLabel(conv) {
  if (!conv?.is_group) return '';
  const local = getLocalGroupLabel(conv.conversation_id);
  if (local) return local;
  if (conv.display_label && !conv.members?.length) return conv.display_label;
  return formatGroupMemberLabel(conv.members);
}