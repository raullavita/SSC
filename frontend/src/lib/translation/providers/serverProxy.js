/**
 * SSC server translation proxy — only when admin enables LIBRETRANSLATE_URL on the API.
 */

import { api } from '../../api';
import { isServerTranslationAvailable } from '../../translationConfig';

export function serverProxyAllowed() {
  return isServerTranslationAvailable();
}

export async function fetchServerLanguages() {
  const data = await api.get('/api/translation/languages');
  return data.languages || [];
}

export async function translateServerProxy(text, { source = 'auto', target = 'en' } = {}) {
  if (!serverProxyAllowed()) {
    return { status: 'unavailable', provider: 'server-proxy', reason: 'not_configured' };
  }

  try {
    const data = await api.post('/api/translation/translate', { text, source, target });
    return {
      status: 'ok',
      text: data.translated_text || '',
      provider: 'server-proxy',
      target,
    };
  } catch (err) {
    return {
      status: 'error',
      provider: 'server-proxy',
      reason: err?.message || 'request_failed',
    };
  }
}