/**
 * SSC server LibreTranslate proxy — LAST RESORT ONLY.
 * Plaintext at proxy; requires explicit opt-in in Settings.
 */

import { api } from '../../api';
import { getServerProxyTranslateEnabled } from '../../chatPrefs';

export function serverProxyAllowed() {
  return getServerProxyTranslateEnabled();
}

export async function fetchServerLanguages() {
  const data = await api.get('/api/translation/languages');
  return data.languages || [];
}

export async function translateServerProxy(text, { source = 'auto', target = 'en' } = {}) {
  if (!serverProxyAllowed()) {
    return { status: 'unavailable', provider: 'server-proxy', reason: 'opt_in_required' };
  }

  try {
    const data = await api.post('/api/translation/translate', { text, source, target });
    return {
      status: 'ok',
      text: data.translated_text || '',
      provider: 'server-proxy',
      target,
      privacyWarning: true,
    };
  } catch (err) {
    return {
      status: 'error',
      provider: 'server-proxy',
      reason: err?.message || 'request_failed',
    };
  }
}