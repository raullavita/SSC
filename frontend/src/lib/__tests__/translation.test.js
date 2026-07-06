import {
  getGoogleTranslateApiKey,
  hasUserTranslationApiKey,
  setGoogleTranslateApiKey,
} from '../translationKeys';
import { getTranslationProviderStatus } from '../translation/providers/index';
import {
  translateText,
  TranslationError,
  DEFAULT_LANGUAGES,
} from '../translation';
import {
  getServerProxyTranslateEnabled,
  setServerProxyTranslateEnabled,
} from '../chatPrefs';

jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('translation provider chain', () => {
  beforeEach(() => {
    localStorage.clear();
    setServerProxyTranslateEnabled(false);
  });

  test('DEFAULT_LANGUAGES includes common codes', () => {
    expect(DEFAULT_LANGUAGES).toContain('en');
    expect(DEFAULT_LANGUAGES).toContain('es');
  });

  test('server proxy disabled by default', () => {
    expect(getServerProxyTranslateEnabled()).toBe(false);
    expect(getTranslationProviderStatus().serverProxy).toBe('disabled');
  });

  test('on-device status reflects unavailable without native or browser engine', () => {
    expect(getTranslationProviderStatus().onDevice).toBe('unavailable');
  });

  test('returns pending_api_key when no providers configured', async () => {
    await expect(
      translateText('Hola mundo', { target: 'en' })
    ).rejects.toMatchObject({ status: 'pending_api_key' });
  });

  test('user API key storage is local only', () => {
    expect(hasUserTranslationApiKey()).toBe(false);
    setGoogleTranslateApiKey('test-google-key');
    expect(getGoogleTranslateApiKey()).toBe('test-google-key');
    expect(hasUserTranslationApiKey()).toBe(true);
  });

  test('translateText throws TranslationError when providers unavailable', async () => {
    jest.spyOn(
      require('../translation/providers/index'),
      'runTranslationChain'
    ).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'Translation unavailable.',
    });

    await expect(
      translateText('Bonjour tout le monde comment allez vous', { target: 'en' })
    ).rejects.toBeInstanceOf(TranslationError);
  });
});