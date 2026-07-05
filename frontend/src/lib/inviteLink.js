const WEB_BASE = process.env.REACT_APP_SSC_WEB_URL || 'https://www.supersecurechat.com';

export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function inviteWebPath(username) {
  const name = normalizeUsername(username);
  return name ? `/add/${encodeURIComponent(name)}` : '/';
}

export function inviteWebUrl(username, base = WEB_BASE) {
  return `${base.replace(/\/$/, '')}${inviteWebPath(username)}`;
}

export function inviteAppUrl(username) {
  const name = normalizeUsername(username);
  return name ? `ssc://add/${name}` : 'ssc://';
}

export function isUserIdQuery(query) {
  return String(query || '').trim().startsWith('u_');
}

export function lookupPathForQuery(query) {
  const raw = String(query || '').trim();
  if (!raw) return '';
  if (raw.startsWith('u_')) {
    return `/api/users/lookup/${encodeURIComponent(raw)}`;
  }
  const username = normalizeUsername(raw);
  return `/api/users/by-username/${encodeURIComponent(username)}`;
}