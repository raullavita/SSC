/**
 * Read receipt display helpers.
 */

function normalizeReaders(readers) {
  if (!readers?.length) return [];
  if (typeof readers[0] === 'string') {
    return readers.map((readAt) => ({ readerId: null, readAt }));
  }
  return readers.map((row) => ({
    readerId: row.readerId || row.reader_id || null,
    readAt: row.readAt || row.read_at,
  }));
}

export function indexReadsByMessage(reads) {
  const map = {};
  for (const row of reads || []) {
    if (!row?.message_id) continue;
    const readerId = row.reader_id || row.readerId || null;
    const readAt = row.read_at || row.readAt;
    if (!map[row.message_id]) map[row.message_id] = [];
    const bucket = map[row.message_id];
    const existing = bucket.find((entry) => entry.readerId === readerId);
    if (existing) {
      if (readAt && (!existing.readAt || readAt > existing.readAt)) {
        existing.readAt = readAt;
      }
    } else {
      bucket.push({ readerId, readAt });
    }
  }
  return map;
}

function formatReadTime(readAt) {
  if (!readAt) return 'Read';
  try {
    return `Read ${new Date(readAt).toLocaleString()}`;
  } catch {
    return 'Read';
  }
}

function resolveName(readerId, nameForId) {
  if (!readerId) return 'Someone';
  if (typeof nameForId === 'function') {
    return nameForId(readerId) || readerId.slice(0, 10);
  }
  return readerId.slice(0, 10);
}

/**
 * Short label for tooltips and compact UI.
 */
export function formatReadReceiptLabel(readers, options = {}) {
  const { isGroup = false, nameForId } = options;
  const list = normalizeReaders(readers);
  if (!list.length) return '';

  if (!isGroup) {
    if (list.length === 1 && list[0].readerId && nameForId) {
      const name = resolveName(list[0].readerId, nameForId);
      return `${formatReadTime(list[0].readAt)} · ${name}`;
    }
    return formatReadTime(list[0].readAt);
  }

  const names = list.map((row) => resolveName(row.readerId, nameForId));
  if (names.length === 1) return `Read by ${names[0]}`;
  if (names.length === 2) return `Read by ${names[0]} and ${names[1]}`;
  if (names.length === 3) return `Read by ${names[0]}, ${names[1]}, and ${names[2]}`;
  return `Read by ${names[0]}, ${names[1]}, and ${names.length - 2} others`;
}

/**
 * Rich label for group message footer (names + optional times).
 */
/**
 * Attach peer reader id for 1:1 chats when the API omits reader_id.
 */
export function enrichDirectReadReceipts(readers, peerId) {
  if (!peerId) return readers || [];
  return (readers || []).map((row) => ({
    ...row,
    readerId: row.readerId || row.reader_id || peerId,
    readAt: row.readAt || row.read_at,
  }));
}

export function formatReadReceiptDetail(readers, options = {}) {
  const { isGroup = false, nameForId, maxNames = 4 } = options;
  const list = normalizeReaders(readers).sort((a, b) =>
    String(a.readAt || '').localeCompare(String(b.readAt || ''))
  );
  if (!list.length) return null;

  if (!isGroup) {
    return {
      short: formatReadReceiptLabel(list, { isGroup, nameForId }),
      entries: list.map((row) => ({
        name: row.readerId ? resolveName(row.readerId, nameForId) : 'Read',
        readAt: row.readAt,
      })),
    };
  }

  const names = list.map((row) => resolveName(row.readerId, nameForId));
  let short;
  if (names.length <= maxNames) {
    short =
      names.length === 1
        ? `Read by ${names[0]}`
        : `Read by ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  } else {
    short = `Read by ${names.slice(0, maxNames).join(', ')} and ${names.length - maxNames} others`;
  }

  return {
    short,
    entries: list.map((row) => ({
      name: resolveName(row.readerId, nameForId),
      readAt: row.readAt,
    })),
  };
}