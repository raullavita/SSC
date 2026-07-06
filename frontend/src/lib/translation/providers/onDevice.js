/**
 * On-device translation — Android ML Kit (native) or Chromium Translator API.
 * No text leaves the device on this path.
 */

import { detectLanguage } from '../../../smart/languageDetect';

function normalizeLang(code) {
  if (!code || code === 'auto') return null;
  return String(code).toLowerCase().slice(0, 2);
}

function nativeAndroidTranslateAvailable() {
  return (
    typeof window !== 'undefined' &&
    window.sscTranslate &&
    window.sscTranslate.__sscNative &&
    window.sscTranslate.available
  );
}

function browserTranslatorAvailable() {
  return typeof Translator !== 'undefined' && typeof Translator.create === 'function';
}

export function getOnDeviceTranslationKind() {
  if (nativeAndroidTranslateAvailable()) return 'android_mlkit';
  if (browserTranslatorAvailable()) return 'browser_translator';
  return 'unavailable';
}

export function onDeviceTranslationSupported() {
  return getOnDeviceTranslationKind() !== 'unavailable';
}

async function onDeviceAvailability(source, target) {
  if (nativeAndroidTranslateAvailable()) {
    try {
      const result = await window.sscTranslate.availability(source, target);
      const status = result?.status || result;
      if (status === 'available' || status === 'downloadable') return 'available';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
  if (!browserTranslatorAvailable()) return 'unavailable';
  try {
    return await Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
  } catch {
    return 'unavailable';
  }
}

async function resolveSourceLanguage(text, source) {
  if (source && source !== 'auto') return normalizeLang(source);
  if (typeof LanguageDetector !== 'undefined' && LanguageDetector.create) {
    try {
      const detector = await LanguageDetector.create();
      const results = await detector.detect(text);
      const top = Array.isArray(results) ? results[0] : results;
      const code = top?.detectedLanguage || top?.language || top;
      if (code) return normalizeLang(code);
    } catch {
      /* fall through */
    }
  }
  return detectLanguage(text);
}

async function translateViaAndroid(text, sourceLang, targetLang) {
  const result = await window.sscTranslate.translate(text, sourceLang, targetLang);
  const payload = typeof result === 'string' ? JSON.parse(result) : result;
  return {
    status: 'ok',
    text: payload?.text || '',
    provider: 'on-device',
    source: payload?.source || sourceLang,
    target: payload?.target || targetLang,
    engine: 'android_mlkit',
  };
}

async function translateViaBrowser(text, sourceLang, targetLang) {
  const translator = await Translator.create({
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
  });
  const translated = await translator.translate(text);
  return {
    status: 'ok',
    text: translated || '',
    provider: 'on-device',
    source: sourceLang,
    target: targetLang,
    engine: 'browser_translator',
  };
}

export async function translateOnDevice(text, { source = 'auto', target = 'en' } = {}) {
  const targetLang = normalizeLang(target) || 'en';
  const sourceLang = (await resolveSourceLanguage(text, source)) || 'en';

  if (sourceLang === targetLang) {
    return { status: 'ok', text, provider: 'on-device', source: sourceLang, target: targetLang };
  }

  if (!onDeviceTranslationSupported()) {
    return { status: 'unavailable', provider: 'on-device', reason: 'no_on_device_engine' };
  }

  const availability = await onDeviceAvailability(sourceLang, targetLang);
  if (availability === 'unavailable') {
    return { status: 'unavailable', provider: 'on-device', reason: 'model_unavailable' };
  }

  try {
    if (nativeAndroidTranslateAvailable()) {
      return await translateViaAndroid(text, sourceLang, targetLang);
    }
    return await translateViaBrowser(text, sourceLang, targetLang);
  } catch {
    return { status: 'unavailable', provider: 'on-device', reason: 'translate_failed' };
  }
}