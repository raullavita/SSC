import {
  isBrowserTab,
  isElectronApp,
  isInstalledClient,
  isNativeApp,
  prefersHashRouter,
} from '../platform';

describe('platform', () => {
  const original = window.sscDesktop;

  afterEach(() => {
    window.sscDesktop = original;
  });

  it('detects Electron desktop shell', () => {
    window.sscDesktop = { isDesktop: true, platform: 'win32' };
    expect(isElectronApp()).toBe(true);
    expect(isInstalledClient()).toBe(true);
    expect(prefersHashRouter()).toBe(true);
  });

  it('browser tab is not an installed client', () => {
    window.sscDesktop = undefined;
    expect(isElectronApp()).toBe(false);
    expect(isNativeApp()).toBe(false);
    expect(isInstalledClient()).toBe(false);
    expect(isBrowserTab()).toBe(true);
  });
});