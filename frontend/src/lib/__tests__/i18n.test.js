import {
  getStoredUiLang,
  isSupportedUiLang,
  loadLocalePack,
  normalizeLang,
  seedUiLangFromDeviceIfNeeded,
  setStoredUiLang,
  t,
} from '../i18n';
import { __resetLocalePackCacheForTests } from '../locales/loadLocalePack';

describe('i18n', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    localStorage.clear();
    __resetLocalePackCacheForTests();
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { language: 'en-US', languages: ['en-US'] },
    });
    delete window.sscDesktop;
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('normalizes language codes to supported UI locales', () => {
    expect(normalizeLang('EN')).toBe('en');
    expect(normalizeLang('es-ES')).toBe('es');
    expect(normalizeLang('fr-FR')).toBe('fr');
    expect(normalizeLang('de-DE')).toBe('de');
    expect(normalizeLang('xx')).toBe('en');
    expect(isSupportedUiLang('fr')).toBe(true);
    expect(isSupportedUiLang('pt')).toBe(false);
  });

  it('persists and reads UI language from localStorage', () => {
    setStoredUiLang('ro');
    expect(getStoredUiLang()).toBe('ro');
  });

  it('uses device locale on first launch when nothing is stored', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { language: 'ro-RO', languages: ['ro-RO', 'en-US'] },
    });
    expect(getStoredUiLang()).toBe('ro');
  });

  it('walks navigator.languages until a supported UI pack is found', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { language: 'pt-PT', languages: ['pt-PT', 'de-DE', 'en-US'] },
    });
    expect(getStoredUiLang()).toBe('de');
  });

  it('detects French device locale', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { language: 'fr-FR', languages: ['fr-FR'] },
    });
    expect(getStoredUiLang()).toBe('fr');
  });

  it('stored preference overrides device locale on installed clients', () => {
    window.sscDesktop = { isDesktop: true };
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { language: 'ro-RO', languages: ['ro-RO'] },
    });
    setStoredUiLang('es');
    expect(getStoredUiLang()).toBe('es');
  });

  it('seeds and persists device locale on first installed launch', () => {
    window.sscDesktop = { isDesktop: true };
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { language: 'es-ES', languages: ['es-ES'] },
    });
    expect(localStorage.getItem('ssc_ui_lang')).toBeNull();
    expect(seedUiLangFromDeviceIfNeeded()).toBe('es');
    expect(localStorage.getItem('ssc_ui_lang')).toBe('es');
    expect(seedUiLangFromDeviceIfNeeded()).toBe('es');
  });

  it('returns English strings by default', () => {
    expect(t('landingLogin', 'en')).toBe('Login');
  });

  it('returns Romanian strings when locale is ro', () => {
    expect(t('landingLogin', 'ro')).toBe('Autentificare');
  });

  it('interpolates variables in translated strings', () => {
    expect(t('inviteFrom', 'en', { user: 'alice' })).toBe('@alice wants to connect');
  });

  it('falls back to English until lazy pack is loaded', () => {
    expect(t('landingLogin', 'fr')).toBe('Login');
  });

  it('uses lazy French pack after load', async () => {
    await loadLocalePack('fr');
    expect(t('landingLogin', 'fr')).toBe('Connexion');
  });
});