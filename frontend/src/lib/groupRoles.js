/** Group roles and permissions — Q.25 */

export const ROLE_OWNER = 'owner';
export const ROLE_ADMIN = 'admin';
export const ROLE_MEMBER = 'member';

export const POSTING_ALL = 'all';
export const POSTING_ADMINS_ONLY = 'admins_only';
export const ADD_MEMBERS_ADMINS = 'admins';
export const ADD_MEMBERS_OWNER_ONLY = 'owner_only';

const DEFAULT_PERMISSIONS = {
  posting: POSTING_ALL,
  add_members: ADD_MEMBERS_ADMINS,
};

export function resolveOwnerId(conv) {
  return conv?.owner_id || conv?.admin_id || conv?.created_by || null;
}

export function ensureMemberRoles(conv) {
  if (!conv?.is_group) return {};
  if (conv.member_roles && Object.keys(conv.member_roles).length > 0) {
    return conv.member_roles;
  }
  const ownerId = resolveOwnerId(conv);
  const roles = {};
  for (const pid of conv.participants || []) {
    roles[pid] = pid === ownerId ? ROLE_OWNER : ROLE_MEMBER;
  }
  return roles;
}

export function groupPermissionsFor(conv) {
  return {
    posting: conv?.group_permissions?.posting || DEFAULT_PERMISSIONS.posting,
    add_members: conv?.group_permissions?.add_members || DEFAULT_PERMISSIONS.add_members,
  };
}

export function getMemberRole(conv, userId) {
  const roles = ensureMemberRoles(conv);
  return roles[userId] || ROLE_MEMBER;
}

export function isPrivilegedRole(role) {
  return role === ROLE_OWNER || role === ROLE_ADMIN;
}

export function canPostInGroup(conv, userId) {
  if (!conv?.is_group) return true;
  if (!(conv.participants || []).includes(userId)) return false;
  const perms = groupPermissionsFor(conv);
  if (perms.posting === POSTING_ALL) return true;
  return isPrivilegedRole(getMemberRole(conv, userId));
}

export function canAddMembers(conv, userId) {
  if (!conv?.is_group) return false;
  const perms = groupPermissionsFor(conv);
  const role = getMemberRole(conv, userId);
  if (perms.add_members === ADD_MEMBERS_OWNER_ONLY) return role === ROLE_OWNER;
  return role === ROLE_OWNER || role === ROLE_ADMIN;
}

export function canRemoveMember(conv, actorId, targetId) {
  if (!(conv?.participants || []).includes(targetId)) return false;
  if (actorId === targetId) return true;
  const targetRole = getMemberRole(conv, targetId);
  if (targetRole === ROLE_OWNER) return false;
  const actorRole = getMemberRole(conv, actorId);
  if (actorRole === ROLE_OWNER) return true;
  if (actorRole === ROLE_ADMIN && targetRole === ROLE_MEMBER) return true;
  return false;
}

export function canManageRoles(conv, userId) {
  return getMemberRole(conv, userId) === ROLE_OWNER;
}

export function canEditGroupProfile(conv, userId) {
  return isPrivilegedRole(getMemberRole(conv, userId));
}

export function roleBadgeKey(role) {
  switch (role) {
    case ROLE_OWNER: return 'groupOwnerBadge';
    case ROLE_ADMIN: return 'groupAdminBadge';
    default: return null;
  }
}