/**
 * Read receipt display helpers.
 */

export function formatReadReceiptLabel(readAtList) {
  if (!readAtList?.length) return '';
  if (readAtList.length === 1) {
    try {
      return `Read ${new Date(readAtList[0]).toLocaleString()}`;
    } catch {
      return 'Read';
    }
  }
  return `Read by ${readAtList.length}`;
}

export function indexReadsByMessage(reads) {
  const map = {};
  for (const row of reads || []) {
    if (!row?.message_id) continue;
    if (!map[row.message_id]) map[row.message_id] = [];
    map[row.message_id].push(row.read_at);
  }
  return map;
}