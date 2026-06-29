import {
  __resetLocalePackCacheForTests,
  getCachedLocalePack,
  isLazyLocale,
  isLocalePackLoaded,
  loadLocalePack,
} from '../loadLocalePack';

describe('loadLocalePack', () => {
  beforeEach(() => {
    __resetLocalePackCacheForTests();
  });

  it('identifies lazy locales', () => {
    expect(isLazyLocale('fr')).toBe(true);
    expect(isLazyLocale('de')).toBe(true);
    expect(isLazyLocale('en')).toBe(false);
  });

  it('loads and caches French pack', async () => {
    const pack = await loadLocalePack('fr');
    expect(pack.landingLogin).toBe('Connexion');
    expect(isLocalePackLoaded('fr')).toBe(true);
    expect(getCachedLocalePack('fr')).toBe(pack);
    await expect(loadLocalePack('fr')).resolves.toBe(pack);
  });

  it('loads German pack with placeholders intact', async () => {
    const pack = await loadLocalePack('de');
    expect(pack.landingDownloadApk).toContain('{version}');
    expect(pack.landingLogin).toBe('Anmelden');
  });

  it('returns null for bundled locales', async () => {
    await expect(loadLocalePack('en')).resolves.toBeNull();
  });
});