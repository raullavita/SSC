import {
  extractUrls,
  fallbackPreview,
  fetchPreviewsForText,
  hostnameFromUrl,
  maybeFetchLinkPreview,
  parsePreviewFromHtml,
} from '../linkPreview';
import { setLinkPreviewsEnabled } from '../chatPrefs';

describe('linkPreview', () => {
  beforeEach(() => {
    localStorage.clear();
    setLinkPreviewsEnabled(false);
    global.fetch = jest.fn();
  });

  test('extractUrls dedupes and strips trailing punctuation', () => {
    const text = 'See https://example.com/path, and https://example.com/path again.';
    expect(extractUrls(text)).toEqual(['https://example.com/path']);
  });

  test('hostnameFromUrl strips www prefix', () => {
    expect(hostnameFromUrl('https://www.example.com/x')).toBe('example.com');
  });

  test('parsePreviewFromHtml reads Open Graph tags', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Example Title" />
        <meta property="og:description" content="Example description" />
        <meta property="og:image" content="https://example.com/img.png" />
      </head></html>
    `;
    expect(parsePreviewFromHtml(html, 'https://example.com')).toEqual({
      url: 'https://example.com',
      hostname: 'example.com',
      title: 'Example Title',
      description: 'Example description',
      image: 'https://example.com/img.png',
      limited: false,
    });
  });

  test('maybeFetchLinkPreview returns null when disabled', async () => {
    await expect(maybeFetchLinkPreview('https://example.com')).resolves.toBeNull();
  });

  test('maybeFetchLinkPreview falls back when fetch fails', async () => {
    setLinkPreviewsEnabled(true);
    global.fetch.mockRejectedValue(new Error('blocked'));
    await expect(maybeFetchLinkPreview('https://news.example.com/story')).resolves.toEqual(
      fallbackPreview('https://news.example.com/story')
    );
  });

  test('fetchPreviewsForText returns empty when disabled', async () => {
    await expect(fetchPreviewsForText('https://example.com')).resolves.toEqual([]);
  });
});