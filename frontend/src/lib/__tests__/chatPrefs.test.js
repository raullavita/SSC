import {
  getAutoTranslateEnabled,
  getLinkPreviewsEnabled,
  getSealedSenderEnabled,
  setAutoTranslateEnabled,
  setLinkPreviewsEnabled,
  setSealedSenderEnabled,
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

  test('sealed sender is on by default', () => {
    expect(getSealedSenderEnabled()).toBe(true);
  });

  test('sealed sender opt-out persists', () => {
    setSealedSenderEnabled(false);
    expect(getSealedSenderEnabled()).toBe(false);
    setSealedSenderEnabled(true);
    expect(getSealedSenderEnabled()).toBe(true);
  });
});