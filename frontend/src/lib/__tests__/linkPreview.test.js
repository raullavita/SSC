import {
  buildUrlFallbackPreview,
  extractFirstPreviewUrl,
  mergePreviewData,
  normalizePreviewUrl,
  parseOpenGraphFromHtml,
} from '../linkPreview';

describe('linkPreview', () => {
  it('extracts and normalizes the first http(s) url', () => {
    expect(extractFirstPreviewUrl('See https://example.com/docs?q=1 today')).toBe(
      'https://example.com/docs?q=1',
    );
    expect(extractFirstPreviewUrl('no links here')).toBeNull();
  });

  it('blocks private and non-http urls', () => {
    expect(normalizePreviewUrl('http://localhost/admin')).toBeNull();
    expect(normalizePreviewUrl('javascript:alert(1)')).toBeNull();
  });

  it('parses open graph metadata from html', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Example Title" />
        <meta property="og:description" content="Example description" />
        <meta property="og:image" content="/cover.png" />
      </head></html>
    `;
    const parsed = parseOpenGraphFromHtml(html, 'https://example.com/page');
    expect(parsed.title).toBe('Example Title');
    expect(parsed.description).toBe('Example description');
    expect(parsed.image).toBe('https://example.com/cover.png');
  });

  it('builds fallback preview from url', () => {
    const preview = buildUrlFallbackPreview('https://news.example.com/a/b');
    expect(preview.title).toBe('news.example.com');
    expect(preview.fetched).toBe(false);
  });

  it('merges fetched metadata over fallback', () => {
    const fallback = buildUrlFallbackPreview('https://example.com');
    const merged = mergePreviewData(fallback, {
      title: 'Better title',
      description: 'Better description',
      image: null,
      siteName: 'Example',
    });
    expect(merged.title).toBe('Better title');
    expect(merged.fetched).toBe(true);
  });
});