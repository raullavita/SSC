import {
  getTranslationCapabilities,
  isOnDeviceTranslationAvailable,
  translateOnDevice,
} from '../nativeTranslate';

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(() => false) },
  registerPlugin: jest.fn(() => ({
    getCapabilities: jest.fn(),
    translate: jest.fn(),
  })),
}));

jest.mock('../../platform', () => ({
  isElectronApp: jest.fn(() => false),
}));

const { isElectronApp } = require('../../platform');

describe('nativeTranslate', () => {
  const original = window.sscDesktop;

  afterEach(() => {
    window.sscDesktop = original;
    jest.clearAllMocks();
  });

  it('reports unavailable on web', () => {
    window.sscDesktop = undefined;
    expect(isOnDeviceTranslationAvailable()).toBe(false);
  });

  it('routes capabilities through desktop IPC bridge', async () => {
    const caps = {
      on_device: true,
      provider: 'transformers_on_device',
      requires_model_download: true,
      languages: ['en', 'es', 'ro'],
    };
    isElectronApp.mockReturnValue(true);
    window.sscDesktop = {
      isDesktop: true,
      translate: { getCapabilities: jest.fn().mockResolvedValue(caps) },
    };

    expect(isOnDeviceTranslationAvailable()).toBe(true);
    await expect(getTranslationCapabilities()).resolves.toEqual(caps);
  });

  it('routes translate through desktop IPC bridge', async () => {
    const result = { translated: 'Salut', provider: 'transformers_on_device' };
    isElectronApp.mockReturnValue(true);
    const translate = jest.fn().mockResolvedValue(result);
    window.sscDesktop = { isDesktop: true, translate: { translate } };

    await expect(translateOnDevice('Hello', 'en', 'ro')).resolves.toEqual(result);
    expect(translate).toHaveBeenCalledWith({
      text: 'Hello',
      source_language: 'en',
      target_language: 'ro',
    });
  });
});