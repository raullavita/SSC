import {
  getOnDeviceTranslationKind,
  onDeviceTranslationSupported,
  translateOnDevice,
} from '../onDevice';

describe('onDevice translation provider', () => {
  const originalSscTranslate = window.sscTranslate;

  beforeEach(() => {
    delete window.sscTranslate;
  });

  afterEach(() => {
    if (originalSscTranslate) {
      window.sscTranslate = originalSscTranslate;
    } else {
      delete window.sscTranslate;
    }
  });

  test('reports unavailable when no native or browser engine', () => {
    expect(getOnDeviceTranslationKind()).toBe('unavailable');
    expect(onDeviceTranslationSupported()).toBe(false);
  });

  test('prefers android_mlkit when sscTranslate bridge is present', () => {
    window.sscTranslate = {
      __sscNative: true,
      available: true,
      availability: jest.fn().mockResolvedValue({ status: 'downloadable' }),
      translate: jest.fn().mockResolvedValue({ text: 'Hello', source: 'es', target: 'en' }),
    };

    expect(getOnDeviceTranslationKind()).toBe('android_mlkit');
    expect(onDeviceTranslationSupported()).toBe(true);
  });

  test('translateOnDevice uses android bridge before browser API', async () => {
    window.sscTranslate = {
      __sscNative: true,
      available: true,
      availability: jest.fn().mockResolvedValue({ status: 'downloadable' }),
      translate: jest.fn().mockResolvedValue({ text: 'Hello world', source: 'es', target: 'en' }),
    };

    const result = await translateOnDevice('Hola mundo', { source: 'es', target: 'en' });
    expect(result).toMatchObject({
      status: 'ok',
      text: 'Hello world',
      provider: 'on-device',
      engine: 'android_mlkit',
    });
    expect(window.sscTranslate.translate).toHaveBeenCalledWith('Hola mundo', 'es', 'en');
  });

  test('returns same text when source equals target', async () => {
    window.sscTranslate = {
      __sscNative: true,
      available: true,
      availability: jest.fn(),
      translate: jest.fn(),
    };

    const result = await translateOnDevice('Hello', { source: 'en', target: 'en' });
    expect(result).toMatchObject({ status: 'ok', text: 'Hello' });
    expect(window.sscTranslate.translate).not.toHaveBeenCalled();
  });

  test('returns unavailable when model is not supported', async () => {
    window.sscTranslate = {
      __sscNative: true,
      available: true,
      availability: jest.fn().mockResolvedValue({ status: 'unavailable' }),
      translate: jest.fn(),
    };

    const result = await translateOnDevice('Hola', { source: 'es', target: 'en' });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'model_unavailable' });
    expect(window.sscTranslate.translate).not.toHaveBeenCalled();
  });
});