/**
 * Translation provider chain — privacy-first order:
 * on-device → user API keys → local LibreTranslate → server proxy (opt-in only).
 */

import {
  translateOnDevice,
  onDeviceTranslationSupported,
  getOnDeviceTranslationKind,
} from './onDevice';
import { translateWithUserApiKeys, userApiKeysConfigured } from './userApiKey';
import { translateLocalLibre, localLibreConfigured } from './localLibre';
import { translateServerProxy, serverProxyAllowed } from './serverProxy';

const CHAIN = [
  { id: 'on-device', run: translateOnDevice },
  { id: 'user-api-key', run: translateWithUserApiKeys },
  { id: 'local-libre', run: translateLocalLibre },
  { id: 'server-proxy', run: translateServerProxy },
];

function onDeviceStatusLabel() {
  const kind = getOnDeviceTranslationKind();
  if (kind === 'android_mlkit') return 'available_android';
  if (kind === 'browser_translator') return 'available_browser';
  return 'unavailable';
}

export function getTranslationProviderStatus() {
  return {
    onDevice: onDeviceStatusLabel(),
    userApiKey: userApiKeysConfigured() ? 'configured' : 'pending_api_key',
    localLibre: localLibreConfigured() ? 'configured' : 'not_configured',
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
      'Translation unavailable. Enable on-device models, add an API key, or opt in to server proxy in Settings.',
  };
}