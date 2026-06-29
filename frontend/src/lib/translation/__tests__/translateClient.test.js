import { api } from '../../api';
import {
  isOnDeviceTranslationAvailable,
  translateOnDevice,
} from '../nativeTranslate';
import {
  resolveTranslationAvailability,
  translateMessageText,
} from '../translateClient';

jest.mock('../../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../nativeTranslate', () => ({
  isOnDeviceTranslationAvailable: jest.fn(),
  translateOnDevice: jest.fn(),
}));

describe('translateClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveTranslationAvailability', () => {
    it('prefers on-device when native bridge is available', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(true);
      api.get.mockResolvedValue({ data: { translation_enabled: true } });

      await expect(resolveTranslationAvailability()).resolves.toEqual({
        onDevice: true,
        serverAllowed: true,
        enabled: true,
        mode: 'on_device',
      });
    });

    it('falls back to server mode when only backend allows translation', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(false);
      api.get.mockResolvedValue({ data: { translation_enabled: true } });

      await expect(resolveTranslationAvailability()).resolves.toEqual({
        onDevice: false,
        serverAllowed: true,
        enabled: true,
        mode: 'server',
      });
    });

    it('disables translation when neither path is available', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(false);
      api.get.mockRejectedValue(new Error('offline'));

      await expect(resolveTranslationAvailability()).resolves.toEqual({
        onDevice: false,
        serverAllowed: false,
        enabled: false,
        mode: 'off',
      });
    });
  });

  describe('translateMessageText', () => {
    it('returns same-language note without calling providers', async () => {
      const result = await translateMessageText({
        text: 'Hola',
        sourceLang: 'es',
        targetLang: 'es',
        serverAllowed: true,
      });

      expect(result).toEqual({ translated: null, note: 'same language' });
      expect(translateOnDevice).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('routes through on-device translation when available', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(true);
      translateOnDevice.mockResolvedValue({
        translated: 'Hello',
        provider: 'transformers_on_device',
      });

      await expect(translateMessageText({
        text: 'Hola',
        sourceLang: 'es',
        targetLang: 'en',
      })).resolves.toEqual({
        translated: 'Hello',
        provider: 'transformers_on_device',
      });

      expect(translateOnDevice).toHaveBeenCalledWith('Hola', 'es', 'en');
    });

    it('treats identical on-device output as same language', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(true);
      translateOnDevice.mockResolvedValue({
        translated: 'Same',
        provider: 'transformers_on_device',
        note: 'same language',
      });

      await expect(translateMessageText({
        text: 'Same',
        sourceLang: 'en',
        targetLang: 'es',
      })).resolves.toEqual({
        translated: null,
        note: 'same language',
        provider: 'transformers_on_device',
      });
    });

    it('uses server path only when explicitly allowed', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(false);
      api.post.mockResolvedValue({
        data: { translated: 'Bonjour', provider: 'server' },
      });

      await expect(translateMessageText({
        text: 'Hello',
        sourceLang: 'en',
        targetLang: 'fr',
        serverAllowed: true,
      })).resolves.toEqual({
        translated: 'Bonjour',
        provider: 'server',
        note: undefined,
      });
    });

    it('throws when translation is unavailable', async () => {
      isOnDeviceTranslationAvailable.mockReturnValue(false);

      await expect(translateMessageText({
        text: 'Hello',
        targetLang: 'es',
        serverAllowed: false,
      })).rejects.toThrow('TRANSLATION_UNAVAILABLE');
    });
  });
});