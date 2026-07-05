import {
  getAutoTranslateEnabled,
  getLinkPreviewsEnabled,
  setAutoTranslateEnabled,
  setLinkPreviewsEnabled,
} from '../chatPrefs';

describe('chatPrefs privacy defaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('auto-translate is off by default', () => {
    expect(getAutoTranslateEnabled()).toBe(false);
  });

  test('auto-translate opt-in persists', () => {
    setAutoTranslateEnabled(true);
    expect(getAutoTranslateEnabled()).toBe(true);
    setAutoTranslateEnabled(false);
    expect(getAutoTranslateEnabled()).toBe(false);
  });

  test('link previews are off by default', () => {
    expect(getLinkPreviewsEnabled()).toBe(false);
  });

  test('link previews opt-in persists', () => {
    setLinkPreviewsEnabled(true);
    expect(getLinkPreviewsEnabled()).toBe(true);
  });
});