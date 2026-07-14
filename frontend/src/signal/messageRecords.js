/**
 * Sesame-style sent message records for decrypt retry / session healing.
 */

const STORAGE_KEY = 'ssc_message_records_v1';
const MAX_RECORDS = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota */
  }
}

export function storeMessageRecord(messageId, { plaintext, peerId, conversationId, deviceCiphertexts }) {
  if (!messageId || !plaintext) return;
  const records = load();
  records[messageId] = {
    plaintext,
    peerId,
    conversationId,
    deviceCiphertexts: deviceCiphertexts || null,
    storedAt: Date.now(),
  };
  const entries = Object.entries(records).sort((a, b) => b[1].storedAt - a[1].storedAt);
  const trimmed = Object.fromEntries(entries.slice(0, MAX_RECORDS));
  save(trimmed);
  pruneMessageRecords();
}

export function getMessageRecord(messageId) {
  const records = load();
  const rec = records[messageId];
  if (!rec) return null;
  if (Date.now() - rec.storedAt > MAX_AGE_MS) {
    delete records[messageId];
    save(records);
    return null;
  }
  return rec;
}

export function deleteMessageRecord(messageId) {
  const records = load();
  if (!records[messageId]) return;
  delete records[messageId];
  save(records);
}

function pruneMessageRecords() {
  const records = load();
  const now = Date.now();
  let changed = false;
  for (const [id, rec] of Object.entries(records)) {
    if (now - rec.storedAt > MAX_AGE_MS) {
      delete records[id];
      changed = true;
    }
  }
  if (changed) save(records);
}