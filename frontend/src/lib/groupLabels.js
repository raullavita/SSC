/**
 * Optional local-only group title (creator device). Not sent to server.
 */
const STORAGE_KEY = 'ssc_group_labels';

function readMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function getLocalGroupLabel(conversationId) {
  if (!conversationId) return '';
  return readMap()[conversationId] || '';
}

export function setLocalGroupLabel(conversationId, label) {
  if (!conversationId || !label?.trim()) return;
  const map = readMap();
  map[conversationId] = label.trim();
  writeMap(map);
}

export function clearLocalGroupLabels() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}