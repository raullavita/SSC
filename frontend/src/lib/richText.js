/** Lightweight markdown for chat messages — Q.18 (client-only, E2E plaintext). */

const UL_LINE_RE = /^(\s*)[-*]\s+(.+)$/;
const OL_LINE_RE = /^(\s*)\d+\.\s+(.+)$/;

export function parseInlineSegments(text) {
  if (!text) return [{ kind: 'plain', text: '' }];
  const segments = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        segments.push({ kind: 'bold', text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith('__', i)) {
      const end = text.indexOf('__', i + 2);
      if (end !== -1) {
        segments.push({ kind: 'bold', text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1 && text[end + 1] !== '*') {
        segments.push({ kind: 'italic', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    let next = text.length;
    for (const marker of ['**', '__', '*']) {
      const idx = text.indexOf(marker, i + (marker === '*' ? 0 : 1));
      if (idx !== -1 && idx < next) next = idx;
    }
    if (next === i) next = i + 1;
    segments.push({ kind: 'plain', text: text.slice(i, next) });
    i = next;
  }
  return segments.length ? segments : [{ kind: 'plain', text }];
}

export function parseRichTextBlocks(text) {
  const lines = String(text ?? '').split('\n');
  const blocks = [];
  let listItems = null;
  let ordered = false;

  const flushList = () => {
    if (listItems?.length) {
      blocks.push({ type: 'list', ordered, items: [...listItems] });
    }
    listItems = null;
  };

  for (const line of lines) {
    const ol = OL_LINE_RE.exec(line);
    const ul = !ol ? UL_LINE_RE.exec(line) : null;
    if (ol) {
      if (!listItems || !ordered) {
        flushList();
        listItems = [];
        ordered = true;
      }
      listItems.push(ol[2]);
      continue;
    }
    if (ul) {
      if (!listItems || ordered) {
        flushList();
        listItems = [];
        ordered = false;
      }
      listItems.push(ul[2]);
      continue;
    }
    flushList();
    if (line.trim() === '') {
      blocks.push({ type: 'spacer' });
    } else {
      blocks.push({ type: 'paragraph', text: line });
    }
  }
  flushList();
  if (!blocks.length) blocks.push({ type: 'paragraph', text: '' });
  return blocks;
}

export function hasRichTextMarkup(text) {
  if (!text) return false;
  if (/(\*\*.+?\*\*|__.+?__)/.test(text)) return true;
  if (/(?<![*])\*(?!\*)(.+?)(?<![*])\*(?!\*)/.test(text)) return true;
  if (/^[-*]\s+/m.test(text)) return true;
  if (/^\d+\.\s+/m.test(text)) return true;
  return false;
}