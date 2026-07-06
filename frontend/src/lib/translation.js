/**
 * Translation client — privacy-first provider chain (on-device default).
 */

import { DEFAULT_LANGUAGES } from './translation/languages';
import { fetchLocalLibreLanguages } from './translation/providers/localLibre';
import { fetchServerLanguages, serverProxyAllowed } from './translation/providers/serverProxy';
import {
  getTranslationProviderStatus,
  runTranslationChain,
} from './translation/providers/index';

export { getTranslationProviderStatus, DEFAULT_LANGUAGES };

export class TranslationError extends Error {
  constructor(message, { status, provider } = {}) {
    super(message);
    this.name = 'TranslationError';
    this.status = status;
    this.provider = provider;
  }
}

export async function fetchLanguages() {
  const local = await fetchLocalLibreLanguages();
  if (local?.length) return local;
  if (serverProxyAllowed()) {
    try {
      return await fetchServerLanguages();
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_LANGUAGES;
}

async function translateTextDetailed(text, options = {}) {
  return runTranslationChain(text, options);
}

export async function translateText(text, options = {}) {
  const result = await translateTextDetailed(text, options);
  if (result.status === 'ok') return result.text;
  if (result.status === 'pending_api_key') {
    throw new TranslationError(
      result.message || 'Add a translation API key in Settings.',
      result
    );
  }
  throw new TranslationError(
    result.message || 'Translation unavailable.',
    result
  );
}