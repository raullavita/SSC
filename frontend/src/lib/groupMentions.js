/** @mentions in group chats — Q.17 */

export const MAX_MENTIONED_USERS = 20;

const MENTION_TOKEN_RE = /@([a-zA-Z][a-zA-Z0-9_]{3,11})(?![a-zA-Z0-9_])/g;
const ACTIVE_MENTION_RE = /(^|[\s])@([a-zA-Z0-9_]*)$/;

export function getActiveMentionAtCursor(text, cursor, members = []) {
  const pos = cursor == null || cursor < 0 ? text.length : cursor;
  const before = text.slice(0, pos);
  const match = before.match(ACTIVE_MENTION_RE);
  if (!match) return null;
  const atIndex = before.lastIndexOf('@');
  const query = match[2] || '';
  if (query && members.length) {
    const exact = members.find((m) => m.username?.toLowerCase() === query.toLowerCase());
    if (exact) return null;
  }
  return { query, startIndex: atIndex };
}

export function filterMentionCandidates(query, members, myUserId) {
  const q = (query || '').toLowerCase();
  return (members || [])
    .filter((m) => m.user_id !== myUserId && m.username)
    .filter((m) => !q || m.username.toLowerCase().startsWith(q))
    .slice(0, 8);
}

export function insertMentionAt(draft, startIndex, username) {
  const before = draft.slice(0, startIndex);
  const after = draft.slice(startIndex).replace(/^@[a-zA-Z0-9_]*/, '');
  return `${before}@${username} ${after}`;
}

export function resolveMentionedUserIds(text, members) {
  const byUsername = new Map();
  for (const m of members || []) {
    if (m.username) byUsername.set(m.username.toLowerCase(), m.user_id);
  }
  const ids = [];
  const seen = new Set();
  let match;
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    const uid = byUsername.get(match[1].toLowerCase());
    if (uid && !seen.has(uid)) {
      seen.add(uid);
      ids.push(uid);
      if (ids.length >= MAX_MENTIONED_USERS) break;
    }
  }
  return ids;
}

export function splitTextForMentions(text, members) {
  if (!text) return [];
  const byUsername = new Map();
  for (const m of members || []) {
    if (m.username) {
      byUsername.set(m.username.toLowerCase(), { username: m.username, userId: m.user_id });
    }
  }
  const parts = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), isMention: false });
    }
    const info = byUsername.get(match[1].toLowerCase());
    if (info) {
      parts.push({
        text: match[0],
        isMention: true,
        username: info.username,
        userId: info.userId,
      });
    } else {
      parts.push({ text: match[0], isMention: false });
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMention: false });
  }
  if (parts.length === 0) {
    parts.push({ text, isMention: false });
  }
  return parts;
}