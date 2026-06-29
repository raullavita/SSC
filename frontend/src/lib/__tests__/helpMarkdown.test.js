import { getFaqArticles } from '../help/faqContent';
import { parseHelpInlineSegments, parseHelpMarkdownBlocks } from '../help/helpMarkdown';

describe('helpMarkdown', () => {
  it('parses headings and paragraphs', () => {
    const blocks = parseHelpMarkdownBlocks('## Title\n\nHello **world**');
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: 'Title' });
    expect(blocks[1]).toEqual({ type: 'spacer' });
    expect(blocks[2].type).toBe('paragraph');
  });

  it('parses markdown links', () => {
    const segs = parseHelpInlineSegments('Email [support](mailto:a@b.com) now');
    expect(segs.some((s) => s.kind === 'link' && s.href === 'mailto:a@b.com')).toBe(true);
  });

  it('bundles FAQ per locale with en fallback', () => {
    expect(getFaqArticles('en').length).toBeGreaterThan(2);
    expect(getFaqArticles('es')[0].title).toMatch(/pasos/i);
    expect(getFaqArticles('fr')[0].title).toBe(getFaqArticles('en')[0].title);
  });
});