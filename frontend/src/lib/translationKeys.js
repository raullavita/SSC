/**
 * Translation API keys — stored locally on device only (never sent to SSC server).
 * Values are base64-encoded at rest. Native shells may migrate to secure storage later.
 */

const GOOGLE_KEY = 'ssc_translate_key_google';
const DEEPL_KEY = 'ssc_translate_key_deepl';

function encode(value) {
  if (!value) return '';
  try {
    return btoa(unescape(encodeURIComponent(value.trim())));
  } catch {
    return '';
  }
}

function decode(stored) {
  if (!stored) return '';
  try {
    return decodeURIComponent(escape(atob(stored)));
  } catch {
    return '';
  }
}

export function getGoogleTranslateApiKey() {
  try {
    return decode(localStorage.getItem(GOOGLE_KEY) || '');
  } catch {
    return '';
  }
}

export function setGoogleTranslateApiKey(value) {
  try {
    const encoded = encode(value);
    if (encoded) localStorage.setItem(GOOGLE_KEY, encoded);
    else localStorage.removeItem(GOOGLE_KEY);
  } catch {
    /* ignore */
  }
}

export function getDeepLApiKey() {
  try {
    return decode(localStorage.getItem(DEEPL_KEY) || '');
  } catch {
    return '';
  }
}

export function setDeepLApiKey(value) {
  try {
    const encoded = encode(value);
    if (encoded) localStorage.setItem(DEEPL_KEY, encoded);
    else localStorage.removeItem(DEEPL_KEY);
  } catch {
    /* ignore */
  }
}

export function hasUserTranslationApiKey() {
  return Boolean(getGoogleTranslateApiKey() || getDeepLApiKey());
}