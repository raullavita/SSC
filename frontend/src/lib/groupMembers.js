/** Group member list helpers — Q.27 (sort, badges, joined date). */

import {
  ROLE_ADMIN,
  ROLE_OWNER,
  getMemberRole,
  roleBadgeKey,
} from './groupRoles';

const ROLE_SORT_RANK = {
  [ROLE_OWNER]: 0,
  [ROLE_ADMIN]: 1,
  member: 2,
};

export function memberJoinedAt(conv, userId) {
  const fromMember = (conv?.members || []).find((m) => m.user_id === userId)?.joined_at;
  if (fromMember) return fromMember;
  return conv?.member_joined_at?.[userId] || conv?.created_at || null;
}

export function formatMemberJoinedDate(iso, locale) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function roleBadgeTone(role) {
  switch (role) {
    case ROLE_OWNER:
      return 'owner';
    case ROLE_ADMIN:
      return 'admin';
    default:
      return null;
  }
}

export function buildGroupMemberRows(conv, myUser) {
  if (!conv?.is_group) return [];
  const byId = new Map();
  for (const m of conv.members || []) {
    if (m?.user_id) {
      byId.set(m.user_id, { ...m, joined_at: m.joined_at || memberJoinedAt(conv, m.user_id) });
    }
  }
  if (myUser?.user_id && !byId.has(myUser.user_id)) {
    byId.set(myUser.user_id, {
      user_id: myUser.user_id,
      username: myUser.username,
      avatar: myUser.avatar,
      joined_at: memberJoinedAt(conv, myUser.user_id),
    });
  }
  const rows = [...byId.values()];
  rows.sort((a, b) => {
    const roleA = getMemberRole(conv, a.user_id);
    const roleB = getMemberRole(conv, b.user_id);
    const rank = (ROLE_SORT_RANK[roleA] ?? 9) - (ROLE_SORT_RANK[roleB] ?? 9);
    if (rank !== 0) return rank;
    const joinedCmp = (a.joined_at || '').localeCompare(b.joined_at || '');
    if (joinedCmp !== 0) return joinedCmp;
    return (a.username || '').localeCompare(b.username || '');
  });
  return rows;
}

export { roleBadgeKey };