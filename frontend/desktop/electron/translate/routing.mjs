/**
 * Desktop translation routing — mirror of src/lib/translation/translateRouting.js.
 */

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

export const SUPPORTED = new Set(['en', 'es', 'ro', 'fr', 'de', 'it']);

export function hasDirectPair(source, target) {
  return Boolean(DESKTOP_MODEL_BY_PAIR[`${source}-${target}`]);
}

export function planTranslationRoute(source, target) {
  if (source === target) return [];
  if (hasDirectPair(source, target)) {
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

export function modelForPair(source, target) {
  return DESKTOP_MODEL_BY_PAIR[`${source}-${target}`] || null;
}