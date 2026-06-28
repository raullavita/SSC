import { normalizeTenorResults, searchTenorGifs } from '../gifSearch';

describe('gifSearch', () => {
  it('normalizes tenor payload', () => {
    const out = normalizeTenorResults({
      results: [{
        id: '1',
        title: 'hi',
        media_formats: {
          nanogif: { url: 'https://example.com/n.gif' },
          gif: { url: 'https://example.com/full.gif' },
        },
      }],
    });
    expect(out).toEqual([{
      id: '1',
      title: 'hi',
      previewUrl: 'https://example.com/n.gif',
      gifUrl: 'https://example.com/full.gif',
    }]);
  });

  it('returns empty without api key', async () => {
    await expect(searchTenorGifs('wave', '')).resolves.toEqual([]);
  });
});