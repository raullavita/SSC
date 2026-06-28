import {
  hasRichTextMarkup,
  parseInlineSegments,
  parseRichTextBlocks,
} from '../richText';

describe('richText', () => {
  it('parses bold and italic inline segments', () => {
    expect(parseInlineSegments('plain **bold** tail')).toEqual([
      { kind: 'plain', text: 'plain ' },
      { kind: 'bold', text: 'bold' },
      { kind: 'plain', text: ' tail' },
    ]);
    expect(parseInlineSegments('start *italic* end')).toEqual([
      { kind: 'plain', text: 'start ' },
      { kind: 'italic', text: 'italic' },
      { kind: 'plain', text: ' end' },
    ]);
  });

  it('parses unordered and ordered list blocks', () => {
    const blocks = parseRichTextBlocks('- one\n- two\n\npara\n1. a\n2. b');
    expect(blocks).toEqual([
      { type: 'list', ordered: false, items: ['one', 'two'] },
      { type: 'spacer' },
      { type: 'paragraph', text: 'para' },
      { type: 'list', ordered: true, items: ['a', 'b'] },
    ]);
  });

  it('detects rich text markup', () => {
    expect(hasRichTextMarkup('hello')).toBe(false);
    expect(hasRichTextMarkup('**bold**')).toBe(true);
    expect(hasRichTextMarkup('- item')).toBe(true);
  });
});