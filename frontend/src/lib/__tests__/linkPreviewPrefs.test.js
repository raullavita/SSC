import {
  linkPreviewsEnabled,
  setLinkPreviewsEnabled,
  subscribeLinkPreviewPrefs,
} from '../linkPreviewPrefs';

describe('linkPreviewPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to disabled', () => {
    expect(linkPreviewsEnabled()).toBe(false);
  });

  it('persists opt-in and notifies subscribers', () => {
    const seen = [];
    const unsub = subscribeLinkPreviewPrefs((enabled) => seen.push(enabled));
    setLinkPreviewsEnabled(true);
    expect(linkPreviewsEnabled()).toBe(true);
    expect(seen).toEqual([true]);
    unsub();
  });
});