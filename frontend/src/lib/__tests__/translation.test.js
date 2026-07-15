import { getTranslationProviderStatus } from '../translation/providers/index';
import {
  translateText,
  TranslationError,
  DEFAULT_LANGUAGES,
} from '../translation';
import { fetchTranslationConfig } from '../translationConfig';

jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('translation provider chain', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    const { api } = require('../api');
    api.get.mockResolvedValue({ translation_enabled: false });
  });

  test('DEFAULT_LANGUAGES includes common codes', () => {
    expect(DEFAULT_LANGUAGES).toContain('en');
    expect(DEFAULT_LANGUAGES).toContain('es');
  });

  test('server translation reports coming_soon when admin has not enabled it', async () => {
    await fetchTranslationConfig();
    const status = getTranslationProviderStatus();
    expect(status.onDevice).toBe('disabled');
    expect(status.userApiKey).toBe('disabled');
    expect(status.localLibre).toBe('disabled');
    expect(status.serverProxy).toBe('coming_soon');
  });

  test('server translation reports available when admin enables it', async () => {
    const { api } = require('../api');
    api.get.mockResolvedValueOnce({ translation_enabled: true, translation_provider: 'libretranslate' });
    await fetchTranslationConfig();
    expect(getTranslationProviderStatus().serverProxy).toBe('available');
  });

  test('translateText throws when SSC translation service is not enabled', async () => {
    await fetchTranslationConfig();
    await expect(translateText('Hola mundo', { target: 'en' })).rejects.toBeInstanceOf(
      TranslationError
    );
  });

  test('translateText throws TranslationError when server returns unavailable', async () => {
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