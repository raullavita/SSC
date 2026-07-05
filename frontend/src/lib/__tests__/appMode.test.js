import { appVersionLabel, isInstalledApp, isMarketingWebOnly } from '../appMode';

describe('appMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete window.__SSC_ELECTRON_CLIENT;
    delete window.__SSC_ANDROID_CLIENT;
    delete window.__SSC_IOS_CLIENT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('isMarketingWebOnly when landing flag is true', () => {
    process.env.REACT_APP_SSC_LANDING_ONLY = 'true';
    expect(isMarketingWebOnly()).toBe(true);
    expect(isInstalledApp()).toBe(false);
  });

  test('isInstalledApp via electron platform env', () => {
    process.env.REACT_APP_SSC_PLATFORM = 'electron';
    expect(isInstalledApp()).toBe(true);
  });

  test('isInstalledApp via runtime electron marker', () => {
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.0/3';
    expect(isInstalledApp()).toBe(true);
  });

  test('web browser is not installed app', () => {
    process.env.REACT_APP_SSC_PLATFORM = 'web';
    expect(isInstalledApp()).toBe(false);
  });

  test('appVersionLabel includes version and build', () => {
    process.env.REACT_APP_SSC_VERSION = '0.3.0';
    process.env.REACT_APP_SSC_BUILD = '3';
    expect(appVersionLabel()).toBe('v0.3.0 (build 3)');
  });
});