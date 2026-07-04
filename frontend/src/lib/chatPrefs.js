/**
 * Client-side chat preferences (translation, auto-translate).
 * Stored locally — not synced to server for privacy.
 */

const AUTO_TRANSLATE_KEY = 'ssc_auto_translate';
const USER_LANG_KEY = 'ssc_user_lang';

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