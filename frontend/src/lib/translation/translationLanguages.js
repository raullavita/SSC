/**
 * On-device message translation languages — Engine 9 (Q.48).
 * UI app languages (i18n LANGS) are separate from message translate capability.
 */

/** Profile / incoming-message translation languages across platforms. */
export const MESSAGE_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ro', label: 'Română' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

/** Transformers.js desktop — Xenova OPUS-MT ONNX pairs available. */
export const DESKTOP_TRANSLATION_LANGS = ['de', 'en', 'es', 'fr', 'it', 'ro'];

/** Google ML Kit on-device (Android). */
export const ANDROID_TRANSLATION_LANGS = ['de', 'en', 'es', 'fr', 'it', 'pt', 'ro'];

const MESSAGE_LANG_SET = new Set(MESSAGE_LANGS.map((l) => l.code));

export function normalizeMessageLang(code, fallback = null) {
  if (!code || typeof code !== 'string') return fallback;
  const tag = code.toLowerCase().trim().split('-')[0];
  return MESSAGE_LANG_SET.has(tag) ? tag : fallback;
}

export function languagesForProvider(provider) {
  if (provider === 'transformers_on_device') return [...DESKTOP_TRANSLATION_LANGS];
  if (provider === 'mlkit_on_device') return [...ANDROID_TRANSLATION_LANGS];
  return [];
}

export function isPairSupportedOnPlatform(source, target, languages) {
  const src = normalizeMessageLang(source, null);
  const tgt = normalizeMessageLang(target, null);
  if (!src || !tgt || src === tgt) return false;
  const supported = new Set(languages);
  return supported.has(src) && supported.has(tgt);
}