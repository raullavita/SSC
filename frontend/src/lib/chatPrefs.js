/**
 * Client-side chat preferences — stored locally for privacy.
 */

const AUTO_TRANSLATE_KEY = 'ssc_auto_translate';
const USER_LANG_KEY = 'ssc_user_lang';
const SEALED_SENDER_KEY = 'ssc_sealed_sender';
const LINK_PREVIEWS_KEY = 'ssc_link_previews';
const LOCAL_TRANSLATE_URL_KEY = 'ssc_local_translate_url';

export function getAutoTranslateEnabled() {
  try {
    const v = localStorage.getItem(AUTO_TRANSLATE_KEY);
    return v !== 'false';
  } catch {
    return true;
  }
}

export function setAutoTranslateEnabled(enabled) {
  try {
    localStorage.setItem(AUTO_TRANSLATE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function getPreferredLanguage() {
  try {
    return localStorage.getItem(USER_LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function setPreferredLanguage(lang) {
  try {
    localStorage.setItem(USER_LANG_KEY, lang || 'en');
  } catch {
    /* ignore */
  }
}

export function getSealedSenderEnabled() {
  try {
    return localStorage.getItem(SEALED_SENDER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSealedSenderEnabled(enabled) {
  try {
    localStorage.setItem(SEALED_SENDER_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function getLinkPreviewsEnabled() {
  try {
    return localStorage.getItem(LINK_PREVIEWS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLinkPreviewsEnabled(enabled) {
  try {
    localStorage.setItem(LINK_PREVIEWS_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function getLocalTranslateUrl() {
  try {
    return localStorage.getItem(LOCAL_TRANSLATE_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function setLocalTranslateUrl(url) {
  try {
    localStorage.setItem(LOCAL_TRANSLATE_URL_KEY, (url || '').trim());
  } catch {
    /* ignore */
  }
}