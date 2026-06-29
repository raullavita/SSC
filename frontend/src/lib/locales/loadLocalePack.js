/**
 * Lazy-loaded UI locale packs (Q.47) — add new JSON files + register here.
 */
const LOADERS = {
  fr: () => import('./fr.json'),
  de: () => import('./de.json'),
};

/** @type {Map<string, Record<string, string>>} */
const cache = new Map();

/** @type {Map<string, Promise<Record<string, string>|null>>} */
const inflight = new Map();

export const LAZY_LOCALE_CODES = Object.freeze(Object.keys(LOADERS));

export function isLazyLocale(code) {
  return Object.prototype.hasOwnProperty.call(LOADERS, code);
}

export function getCachedLocalePack(code) {
  return cache.get(code) || null;
}

export function isLocalePackLoaded(code) {
  return cache.has(code);
}

/**
 * Fetch and cache a lazy locale pack. Resolves null for unknown codes.
 * @param {string} code
 * @returns {Promise<Record<string, string>|null>}
 */
export async function loadLocalePack(code) {
  const lang = (code || '').toLowerCase().slice(0, 2);
  if (!isLazyLocale(lang)) return null;
  if (cache.has(lang)) return cache.get(lang);
  if (inflight.has(lang)) return inflight.get(lang);

  const promise = LOADERS[lang]()
    .then((mod) => {
      const pack = mod?.default || mod;
      cache.set(lang, pack);
      inflight.delete(lang);
      return pack;
    })
    .catch((err) => {
      inflight.delete(lang);
      throw err;
    });

  inflight.set(lang, promise);
  return promise;
}

/** Test helper — reset module state between Jest cases. */
export function __resetLocalePackCacheForTests() {
  cache.clear();
  inflight.clear();
}