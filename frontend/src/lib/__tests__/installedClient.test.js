import {
  getAndroidShellFeatures,
  getInstalledClientHeader,
  getInstalledClientHeaders,
  isAndroidShell,
} from '../installedClient';

describe('installedClient', () => {
  beforeEach(() => {
    delete window.__SSC_ELECTRON_CLIENT;
    delete window.__SSC_ANDROID_CLIENT;
    delete window.__SSC_ANDROID_SHELL;
    delete window.__SSC_ANDROID_FEATURES;
  });
  test('builds header with platform version build', () => {
    expect(getInstalledClientHeader()).toMatch(/^(android|ios|windows|mac|electron)\/\d+\.\d+\.\d+\/\d+$/);
  });

  test('getInstalledClientHeaders includes X-SSC-Client', () => {
    const headers = getInstalledClientHeaders({ 'X-Test': '1' });
    expect(headers['X-SSC-Client']).toBeTruthy();
    expect(headers['X-Test']).toBe('1');
  });

  test('reads injected Electron client header', () => {
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.0/3';
    expect(getInstalledClientHeader()).toBe('electron/0.3.0/3');
  });

  test('reads injected Android shell flags', () => {
    window.__SSC_ANDROID_CLIENT = 'android/0.3.0/3';
    window.__SSC_ANDROID_SHELL = '1';
    window.__SSC_ANDROID_FEATURES = 'deep_links,pull_to_refresh';
    expect(getInstalledClientHeader()).toBe('android/0.3.0/3');
    expect(isAndroidShell()).toBe(true);
    expect(getAndroidShellFeatures()).toEqual(['deep_links', 'pull_to_refresh']);
  });
});