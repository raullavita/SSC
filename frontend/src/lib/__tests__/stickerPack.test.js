import { BUNDLED_STICKERS, findBundledSticker, stickerSvgMarkup } from '../stickerPack';

describe('stickerPack', () => {
  it('exports bundled stickers', () => {
    expect(BUNDLED_STICKERS.length).toBeGreaterThanOrEqual(6);
    expect(findBundledSticker('thumbs')?.label).toBe('👍');
  });

  it('builds svg markup', () => {
    const svg = stickerSvgMarkup(BUNDLED_STICKERS[0]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('👍');
  });
});