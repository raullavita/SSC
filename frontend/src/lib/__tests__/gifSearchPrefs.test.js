import {
  gifSearchEnabled,
  setGifSearchEnabled,
  subscribeGifSearchPrefs,
} from '../gifSearchPrefs';

describe('gifSearchPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to disabled', () => {
    expect(gifSearchEnabled()).toBe(false);
  });

  it('persists opt-in', () => {
    const seen = [];
    subscribeGifSearchPrefs((v) => seen.push(v));
    setGifSearchEnabled(true);
    expect(gifSearchEnabled()).toBe(true);
    expect(seen).toEqual([true]);
  });
});