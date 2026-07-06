import { getInstalledClientHeader, getInstalledClientHeaders } from '../installedClient';

describe('installedClient', () => {
  beforeEach(() => {
    delete window.__SSC_ELECTRON_CLIENT;
    delete window.__SSC_ANDROID_CLIENT;
    delete window.__SSC_ANDROID_SHELL;
    delete window.__SSC_ANDROID_FEATURES;
    delete window.__SSC_NATIVE_BRIDGE;
  });

  test('builds header with platform version build', () => {
    expect(getInstalledClientHeader()).toMatch(
      /^(android|ios|windows|mac|electron)\/\d+\.\d+\.\d+\/\d+$/
    );
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

  test('includes native bridge header when attested', () => {
    window.__SSC_NATIVE_BRIDGE = 'v1';
    expect(getInstalledClientHeaders()['X-SSC-Native-Bridge']).toBe('v1');
  });
});