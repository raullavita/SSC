/**
 * User-held translation API keys — Google Cloud Translation / DeepL.
 * Calls go directly from the client to the provider (not through SSC server).
 */

import { getDeepLApiKey, getGoogleTranslateApiKey, hasUserTranslationApiKey } from '../../translationKeys';

function normalizeLang(code) {
  if (!code || code === 'auto') return undefined;
  return String(code).toLowerCase().slice(0, 2);
}

export function userApiKeysConfigured() {
  return hasUserTranslationApiKey();
}

async function translateGoogle(text, { source, target }) {
  const apiKey = getGoogleTranslateApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({ key: apiKey, q: text, target });
  const src = normalizeLang(source);
  if (src) params.set('source', src);

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, {
    method: 'POST',
  });
  if (!res.ok) return { status: 'error', provider: 'google', reason: `http_${res.status}` };

  const data = await res.json();
  const translated = data?.data?.translations?.[0]?.translatedText || '';
  return { status: 'ok', text: translated, provider: 'google', target };
}

async function translateDeepL(text, { source, target }) {
  const apiKey = getDeepLApiKey();
  if (!apiKey) return null;

  const body = new URLSearchParams({ text, target_lang: target.toUpperCase() });
  const src = normalizeLang(source);
  if (src) body.set('source_lang', src.toUpperCase());

  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const proRes = await fetch('https://api.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!proRes.ok) return { status: 'error', provider: 'deepl', reason: `http_${proRes.status}` };
    const proData = await proRes.json();
    const proText = proData?.translations?.[0]?.text || '';
    return { status: 'ok', text: proText, provider: 'deepl', target };
  }

  const data = await res.json();
  const translated = data?.translations?.[0]?.text || '';
  return { status: 'ok', text: translated, provider: 'deepl', target };
}

export async function translateWithUserApiKeys(text, { source = 'auto', target = 'en' } = {}) {
  if (!userApiKeysConfigured()) {
    return { status: 'pending_api_key', provider: 'user-api-key' };
  }

  const opts = { source, target: normalizeLang(target) || 'en' };

  if (getGoogleTranslateApiKey()) {
    const google = await translateGoogle(text, opts);
    if (google?.status === 'ok') return google;
  }

  if (getDeepLApiKey()) {
    const deepl = await translateDeepL(text, opts);
    if (deepl?.status === 'ok') return deepl;
  }

  return { status: 'error', provider: 'user-api-key', reason: 'provider_failed' };
}