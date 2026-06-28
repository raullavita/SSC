/**
 * Unified translation client — Engine 9.
 * Android: ML Kit on-device (no server plaintext).
 * Web: server path only when backend explicitly enables it (dev/demo).
 */
import { api } from '../api';
import { isOnDeviceTranslationAvailable, translateOnDevice } from './nativeTranslate';

const BAD_RESPONSE = /PLEASE SELECT TWO DISTINCT LANGUAGES|MYMEMORY WARNING|AUTO_DETECT LANGUAGE NOT SUPPORTED/i;

export async function resolveTranslationAvailability() {
  const onDevice = isOnDeviceTranslationAvailable();
  let serverAllowed = false;
  try {
    const { data } = await api.get('/config');
    serverAllowed = !!data?.translation_enabled;
  } catch {
    serverAllowed = false;
  }
  return {
    onDevice,
    serverAllowed,
    enabled: onDevice || serverAllowed,
    mode: onDevice ? 'on_device' : (serverAllowed ? 'server' : 'off'),
  };
}

function sameLanguage(sourceLang, targetLang) {
  return Boolean(
    sourceLang && targetLang && sourceLang.toLowerCase() === targetLang.toLowerCase(),
  );
}

function isBadTranslation(out, note) {
  return !out
    || BAD_RESPONSE.test(out)
    || note === 'translation service unavailable or same language';
}

export async function translateMessageText({
  text,
  sourceLang,
  targetLang,
  serverAllowed = false,
}) {
  if (!text || !targetLang) {
    return { translated: null, note: 'missing text or target' };
  }
  if (sameLanguage(sourceLang, targetLang)) {
    return { translated: null, note: 'same language' };
  }

  if (isOnDeviceTranslationAvailable()) {
    const result = await translateOnDevice(text, sourceLang, targetLang);
    const out = result?.translated;
    if (result?.note === 'same language' || !out || out.toLowerCase() === text.toLowerCase()) {
      return { translated: null, note: 'same language', provider: result?.provider };
    }
    return { translated: out, provider: result?.provider || 'on_device' };
  }

  if (!serverAllowed) {
    throw new Error('TRANSLATION_UNAVAILABLE');
  }

  const payload = { text, target_language: targetLang };
  if (sourceLang) payload.source_language = sourceLang;
  const { data } = await api.post('/translate', payload);
  if (data.note === 'same language') {
    return { translated: null, note: 'same language', provider: data.provider };
  }
  const out = data.translated;
  if (isBadTranslation(out, data.note) || out.toLowerCase() === text.toLowerCase()) {
    return { translated: null, note: data.note, provider: data.provider };
  }
  return { translated: out, provider: data.provider, note: data.note };
}