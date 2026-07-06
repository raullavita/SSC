import { fetchPreviewsForText } from '../linkPreview';
import { setLinkPreviewsEnabled } from '../chatPrefs';

describe('linkPreview', () => {
  beforeEach(() => {
    localStorage.clear();
    setLinkPreviewsEnabled(false);
    global.fetch = jest.fn();
  });

  test('fetchPreviewsForText returns empty when disabled', async () => {
    await expect(fetchPreviewsForText('https://example.com')).resolves.toEqual([]);
  });

  test('fetchPreviewsForText returns fallback preview when enabled', async () => {
    setLinkPreviewsEnabled(true);
    global.fetch.mockRejectedValue(new Error('blocked'));

    const previews = await fetchPreviewsForText('Check https://news.example.com/story');
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      url: 'https://news.example.com/story',
      hostname: 'news.example.com',
      limited: true,
    });
  });

  test('fetchPreviewsForText parses Open Graph metadata', async () => {
    setLinkPreviewsEnabled(true);
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => `
        <html><head>
          <meta property="og:title" content="Example Title" />
          <meta property="og:description" content="Example description" />
        </head></html>
      `,
    });

    const previews = await fetchPreviewsForText('See https://example.com/page');
    expect(previews[0]).toMatchObject({
      url: 'https://example.com/page',
      title: 'Example Title',
      description: 'Example description',
      limited: false,
    });
  });
});