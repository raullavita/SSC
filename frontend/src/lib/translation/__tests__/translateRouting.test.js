import {
  DESKTOP_MODEL_BY_PAIR,
  DESKTOP_SUPPORTED_LANGS,
  desktopModelForPair,
  hasDesktopDirectPair,
  planDesktopTranslationRoute,
} from '../translateRouting';

describe('translateRouting', () => {
  it('lists expanded desktop language support', () => {
    expect(DESKTOP_SUPPORTED_LANGS).toEqual(['de', 'en', 'es', 'fr', 'it', 'ro']);
  });

  it('includes new OPUS-MT model pairs', () => {
    expect(DESKTOP_MODEL_BY_PAIR['en-fr']).toBe('Xenova/opus-mt-en-fr');
    expect(DESKTOP_MODEL_BY_PAIR['de-en']).toBe('Xenova/opus-mt-de-en');
    expect(DESKTOP_MODEL_BY_PAIR['en-it']).toBe('Xenova/opus-mt-en-it');
    expect(DESKTOP_MODEL_BY_PAIR['en-pt']).toBeUndefined();
  });

  it('uses direct route when available', () => {
    expect(planDesktopTranslationRoute('en', 'fr')).toEqual([
      { source: 'en', target: 'fr' },
    ]);
    expect(hasDesktopDirectPair('fr', 'en')).toBe(true);
    expect(desktopModelForPair('it', 'en')).toBe('Xenova/opus-mt-it-en');
  });

  it('pivots through English for cross pairs', () => {
    expect(planDesktopTranslationRoute('fr', 'de')).toEqual([
      { source: 'fr', target: 'en' },
      { source: 'en', target: 'de' },
    ]);
    expect(planDesktopTranslationRoute('es', 'ro')).toEqual([
      { source: 'es', target: 'en' },
      { source: 'en', target: 'ro' },
    ]);
  });
});