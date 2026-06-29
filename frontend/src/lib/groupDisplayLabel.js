/**
 * Client-side group titles — derived from member display names / usernames (not stored on server).
 */
import { userPrimaryLabel } from './displayName';
import { getLocalGroupLabel } from './groupLabels';

export function formatGroupMemberLabel(members = [], { maxShown = 2 } = {}) {
  const sorted = [...(members || [])]
    .filter((m) => m?.username || m?.display_name)
    .sort((a, b) => userPrimaryLabel(a).localeCompare(userPrimaryLabel(b)));
  if (sorted.length === 0) return 'Group';
  if (sorted.length <= maxShown) {
    return sorted.map((m) => userPrimaryLabel(m)).join(', ');
  }
  const shown = sorted.slice(0, maxShown).map((m) => userPrimaryLabel(m)).join(', ');
  const extra = sorted.length - maxShown;
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