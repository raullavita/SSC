/**
 * Unified translation client — Engine 9.
 * Android: ML Kit on-device (no server plaintext).
 * Web: server path only when backend explicitly enables it (dev/demo).
 */
import { api } from '../api';
import {
  isOnDeviceTranslationAvailable,
  getTranslationCapabilities,
  translateOnDevice,
} from './nativeTranslate';
import {
  isPairSupportedOnPlatform,
  languagesForProvider,
  normalizeMessageLang,
} from './translationLanguages';

const BAD_RESPONSE = /PLEASE SELECT TWO DISTINCT LANGUAGES|MYMEMORY WARNING|AUTO_DETECT LANGUAGE NOT SUPPORTED/i;

let cachedCapabilities = null;

export async function resolveTranslationAvailability() {
  const onDevice = isOnDeviceTranslationAvailable();
  let serverAllowed = false;
  let capabilities = null;
  try {
    const { data } = await api.get('/config');
    serverAllowed = !!data?.translation_enabled;
  } catch {
    serverAllowed = false;
  }
  if (onDevice) {
    try {
      capabilities = await getTranslationCapabilities();
      cachedCapabilities = capabilities;
    } catch {
      capabilities = cachedCapabilities;
    }
  }
  return {
    onDevice,
    serverAllowed,
    enabled: onDevice || serverAllowed,
    mode: onDevice ? 'on_device' : (serverAllowed ? 'server' : 'off'),
    capabilities,
    languages: capabilities?.languages || (onDevice ? [] : []),
  };
}

export function isOnDeviceTranslationPairSupported(sourceLang, targetLang, capabilities) {
  const languages = capabilities?.languages?.length
    ? capabilities.languages
    : languagesForProvider(capabilities?.provider);
  return isPairSupportedOnPlatform(sourceLang, targetLang, languages);
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
    const src = normalizeMessageLang(sourceLang, 'en');
    const tgt = normalizeMessageLang(targetLang, null);
    if (!tgt) {
      return { translated: null, note: 'unsupported target language' };
    }
    if (!cachedCapabilities) {
      try {
        cachedCapabilities = await getTranslationCapabilities();
      } catch {
        cachedCapabilities = null;
      }
    }
    if (cachedCapabilities && !isOnDeviceTranslationPairSupported(src, tgt, cachedCapabilities)) {
      return { translated: null, note: 'unsupported language pair' };
    }
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