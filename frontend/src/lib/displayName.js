/**
 * Display name helpers — Q.37 friendly label vs locked @username handle.
 */

export function userDisplayName(user) {
  const raw = (user?.display_name || '').trim();
  return raw || null;
}

/** Primary label for UI (display name, else @username). */
export function userPrimaryLabel(user) {
  const dn = userDisplayName(user);
  if (dn) return dn;
  if (user?.username) return `@${user.username}`;
  return '';
}

export function userHandle(user) {
  return user?.username ? `@${user.username}` : '';
}

/** "Name (@handle)" when both exist. */
export function formatUserLabel(user) {
  const dn = userDisplayName(user);
  if (dn && user?.username) return `${dn} (@${user.username})`;
  return userPrimaryLabel(user);
}

/** Initials for avatars — display name words first, else username. */
export function userInitials(user) {
  const dn = userDisplayName(user);
  if (dn) {
    const parts = dn.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return dn.slice(0, 2).toUpperCase();
  }
  if (user?.username) return user.username.slice(0, 2).toUpperCase();
  return '?';
}

export function normalizeDisplayNameInput(raw) {
  const collapsed = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  if (collapsed.length > 48) throw new Error('DISPLAY_NAME_TOO_LONG');
  if (collapsed.includes('@')) throw new Error('DISPLAY_NAME_AT');
  return collapsed;
}