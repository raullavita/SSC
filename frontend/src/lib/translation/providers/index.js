/**
 * Translation — SSC server only (admin configures LIBRETRANSLATE_URL on API).
 * No user API keys; no on-device/local translate in the client chain.
 */

import { isServerTranslationAvailable } from '../../translationConfig';
import { translateServerProxy } from './serverProxy';

const CHAIN = [{ id: 'server-proxy', run: translateServerProxy }];

export function getTranslationProviderStatus() {
  const available = isServerTranslationAvailable();
  return {
    onDevice: 'disabled',
    userApiKey: 'disabled',
    localLibre: 'disabled',
    serverProxy: available ? 'available' : 'coming_soon',
  };
}

export async function runTranslationChain(text, options = {}) {
  if (!text?.trim()) {
    return { status: 'ok', text: '', provider: 'none' };
  }

  if (!isServerTranslationAvailable()) {
    return {
      status: 'unavailable',
      provider: 'server',
      message: 'Translation is not available yet. It will be enabled when SSC adds a translation service.',
    };
  }

  for (const step of CHAIN) {
    const result = await step.run(text, options);
    if (!result) continue;
    if (result.status === 'ok' && result.text !== undefined) {
      return result;
    }
  }

  return {
    status: 'unavailable',
    provider: 'server',
    message: 'Translation service is temporarily unavailable. Try again later.',
  };
}