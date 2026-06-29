/**
 * Offline help markdown — Q.39 headings, lists, bold/italic, links.
 */
import { parseInlineSegments } from '../richText';

const HEADING_RE = /^(#{2,3})\s+(.+)$/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const UL_LINE_RE = /^(\s*)[-*]\s+(.+)$/;
const OL_LINE_RE = /^(\s*)\d+\.\s+(.+)$/;

export function parseHelpInlineSegments(text) {
  if (!text) return [{ kind: 'plain', text: '' }];
  const segments = [];
  let last = 0;
  let match;
  const re = new RegExp(LINK_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push(...parseInlineSegments(text.slice(last, match.index)));
    }
    segments.push({ kind: 'link', text: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push(...parseInlineSegments(text.slice(last)));
  }
  return segments.length ? segments : [{ kind: 'plain', text: '' }];
}

export function parseHelpMarkdownBlocks(text) {
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
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }
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
      continue;
    }
    blocks.push({ type: 'paragraph', text: line });
  }
  flushList();
  if (!blocks.length) blocks.push({ type: 'paragraph', text: '' });
  return blocks;
}