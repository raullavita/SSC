/**
 * Translation provider chain — user API keys first, then SSC server proxy (opt-in).
 * On-device and local LibreTranslate are not used (API keys or server only).
 */

import { translateWithUserApiKeys, userApiKeysConfigured } from './userApiKey';
import { translateServerProxy, serverProxyAllowed } from './serverProxy';

const CHAIN = [
  { id: 'user-api-key', run: translateWithUserApiKeys },
  { id: 'server-proxy', run: translateServerProxy },
];

export function getTranslationProviderStatus() {
  return {
    onDevice: 'disabled',
    userApiKey: userApiKeysConfigured() ? 'configured' : 'pending_api_key',
    localLibre: 'disabled',
    serverProxy: serverProxyAllowed() ? 'opted_in' : 'disabled',
  };
}

export async function runTranslationChain(text, options = {}) {
  if (!text?.trim()) {
    return { status: 'ok', text: '', provider: 'none' };
  }

  let sawPendingKey = false;

  for (const step of CHAIN) {
    const result = await step.run(text, options);
    if (!result) continue;
    if (result.status === 'ok' && result.text !== undefined) {
      return result;
    }
    if (result.status === 'pending_api_key') {
      sawPendingKey = true;
    }
  }

  if (sawPendingKey) {
    return {
      status: 'pending_api_key',
      provider: 'user-api-key',
      message: 'Add a Google or DeepL API key in Settings to enable translation.',
    };
  }

  return {
    status: 'unavailable',
    provider: 'none',
    message:
      'Translation unavailable. Add a Google or DeepL API key in Settings, or opt in to the SSC translation server.',
  };
}