import { checkForClientUpdate } from '../clientUpdates';
import * as publicConfig from '../publicConfig';
import * as desktopUpdates from '../desktopUpdates';
import { getPlatform, isElectronApp, isNativeApp } from '../platform';

jest.mock('../publicConfig');
jest.mock('../desktopUpdates');
jest.mock('../platform', () => {
  const actual = jest.requireActual('../platform');
  return {
    ...actual,
    isElectronApp: jest.fn(() => false),
    isNativeApp: jest.fn(() => false),
    getPlatform: jest.fn(() => 'web'),
    isInstalledClient: jest.fn(() => false),
  };
});

describe('clientUpdates', () => {
  const originalDesktop = window.sscDesktop;

  beforeEach(() => {
    jest.clearAllMocks();
    delete window.sscDesktop;
    process.env.REACT_APP_SSC_VERSION = '1.0.12';
    isElectronApp.mockReturnValue(false);
    isNativeApp.mockReturnValue(false);
    getPlatform.mockReturnValue('web');
  });

  afterEach(() => {
    window.sscDesktop = originalDesktop;
    delete process.env.REACT_APP_SSC_VERSION;
  });

  it('delegates desktop checks to electron IPC', async () => {
    isElectronApp.mockReturnValue(true);
    desktopUpdates.checkDesktopUpdates.mockResolvedValue({
      state: 'available',
      version: '1.0.13',
    });

    const result = await checkForClientUpdate({ manual: true });
    expect(desktopUpdates.checkDesktopUpdates).toHaveBeenCalledWith({ manual: true });
    expect(result).toMatchObject({
      platform: 'desktop',
      state: 'available',
      version: '1.0.13',
      localVersion: '1.0.12',
    });
  });

  it('reports current android version from config feed', async () => {
    isNativeApp.mockReturnValue(true);
    getPlatform.mockReturnValue('android');

    publicConfig.fetchPublicConfig.mockResolvedValue({
      client_updates: {
        latest_version: '1.0.12',
        android: { apk_url: 'https://example.com/app.apk' },
      },
    });

    const result = await checkForClientUpdate();
    expect(result).toMatchObject({
      platform: 'android',
      state: 'current',
      localVersion: '1.0.12',
      latestVersion: '1.0.12',
    });
  });

  it('surfaces android update when config version is newer', async () => {
    isNativeApp.mockReturnValue(true);
    getPlatform.mockReturnValue('android');

    publicConfig.fetchPublicConfig.mockResolvedValue({
      client_updates: {
        latest_version: '1.0.13',
        android: {
          apk_url: 'https://example.com/app.apk',
          app_distribution_url: 'https://appdistribution.firebase.dev/testers',
        },
      },
    });

    const result = await checkForClientUpdate();
    expect(result).toMatchObject({
      platform: 'android',
      state: 'available',
      latestVersion: '1.0.13',
      downloadUrl: 'https://appdistribution.firebase.dev/testers',
      useAppDistribution: true,
    });
  });
});