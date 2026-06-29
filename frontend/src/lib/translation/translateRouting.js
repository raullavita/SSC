/**
 * Translation route planning — keep in sync with desktop/electron/translate/routing.mjs.
 */

/** Direct OPUS-MT pairs (Xenova ONNX). */
export const DESKTOP_MODEL_BY_PAIR = {
  'en-es': 'Xenova/opus-mt-en-es',
  'es-en': 'Xenova/opus-mt-es-en',
  'en-ro': 'Xenova/opus-mt-en-ro',
  'ro-en': 'Xenova/opus-mt-ro-en',
  'en-fr': 'Xenova/opus-mt-en-fr',
  'fr-en': 'Xenova/opus-mt-fr-en',
  'en-de': 'Xenova/opus-mt-en-de',
  'de-en': 'Xenova/opus-mt-de-en',
  'en-it': 'Xenova/opus-mt-en-it',
  'it-en': 'Xenova/opus-mt-it-en',
};

export const DESKTOP_SUPPORTED_LANGS = Object.freeze(
  ['en', 'es', 'ro', 'fr', 'de', 'it'].sort(),
);

export function hasDesktopDirectPair(source, target) {
  return Boolean(DESKTOP_MODEL_BY_PAIR[`${source}-${target}`]);
}

/**
 * @returns {{ source: string, target: string }[]}
 */
export function planDesktopTranslationRoute(source, target) {
  if (source === target) return [];
  if (hasDesktopDirectPair(source, target)) {
    return [{ source, target }];
  }
  if (source !== 'en' && target !== 'en') {
    return [
      { source, target: 'en' },
      { source: 'en', target },
    ];
  }
  return [{ source, target }];
}

export function desktopModelForPair(source, target) {
  return DESKTOP_MODEL_BY_PAIR[`${source}-${target}`] || null;
}