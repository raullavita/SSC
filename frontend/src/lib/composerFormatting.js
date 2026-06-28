/** Composer selection helpers for rich-text markers — Q.18 */

export function wrapSelectionWithMarkers(text, start, end, marker) {
  const selStart = start ?? text.length;
  const selEnd = end ?? selStart;
  const selected = text.slice(selStart, selEnd);
  const wrapped = `${marker}${selected}${marker}`;
  const value = `${text.slice(0, selStart)}${wrapped}${text.slice(selEnd)}`;
  const cursor = selStart + wrapped.length;
  return { value, selectionStart: cursor, selectionEnd: cursor };
}

export function prefixSelectionAsList(text, start, end, ordered = false) {
  const selStart = start ?? 0;
  const selEnd = end ?? text.length;
  const block = text.slice(selStart, selEnd);
  const lines = block.length ? block.split('\n') : [''];
  const prefixed = lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (ordered) return `${idx + 1}. ${trimmed}`;
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) return line;
    return `- ${trimmed}`;
  });
  const inserted = prefixed.join('\n');
  const value = `${text.slice(0, selStart)}${inserted}${text.slice(selEnd)}`;
  const cursor = selStart + inserted.length;
  return { value, selectionStart: cursor, selectionEnd: cursor };
}