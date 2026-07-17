/**
 * Translation client — SSC server only (admin enables service on API).
 */

import { DEFAULT_LANGUAGES } from './translation/languages';
import { fetchServerLanguages, serverProxyAllowed } from './translation/providers/serverProxy';
import { runTranslationChain } from './translation/providers/index';

export { DEFAULT_LANGUAGES };

export class TranslationError extends Error {
  constructor(message, { status, provider } = {}) {
    super(message);
    this.name = 'TranslationError';
    this.status = status;
    this.provider = provider;
  }
}

export async function fetchLanguages() {
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
  throw new TranslationError(
    result.message || 'Translation unavailable.',
    result
  );
}