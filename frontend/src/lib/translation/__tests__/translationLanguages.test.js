import {
  ANDROID_TRANSLATION_LANGS,
  DESKTOP_TRANSLATION_LANGS,
  isPairSupportedOnPlatform,
  languagesForProvider,
  MESSAGE_LANGS,
  normalizeMessageLang,
} from '../translationLanguages';

describe('translationLanguages', () => {
  it('exposes message profile languages including pt and it', () => {
    expect(MESSAGE_LANGS.map((l) => l.code)).toEqual(
      ['en', 'es', 'ro', 'fr', 'de', 'it', 'pt'],
    );
  });

  it('tracks per-platform capability lists', () => {
    expect(DESKTOP_TRANSLATION_LANGS).not.toContain('pt');
    expect(ANDROID_TRANSLATION_LANGS).toContain('pt');
    expect(languagesForProvider('transformers_on_device')).toEqual(DESKTOP_TRANSLATION_LANGS);
    expect(languagesForProvider('mlkit_on_device')).toEqual(ANDROID_TRANSLATION_LANGS);
  });

  it('normalizes message language tags', () => {
    expect(normalizeMessageLang('fr-CA')).toBe('fr');
    expect(normalizeMessageLang('xx', 'en')).toBe('en');
    expect(normalizeMessageLang('pt')).toBe('pt');
  });

  it('checks pair support per platform', () => {
    expect(isPairSupportedOnPlatform('en', 'fr', DESKTOP_TRANSLATION_LANGS)).toBe(true);
    expect(isPairSupportedOnPlatform('en', 'pt', DESKTOP_TRANSLATION_LANGS)).toBe(false);
    expect(isPairSupportedOnPlatform('en', 'pt', ANDROID_TRANSLATION_LANGS)).toBe(true);
  });
});