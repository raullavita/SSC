/** Tenor GIF search — Q.22 (client fetch when opt-in; key from env or public config). */

import { fetchPublicConfig } from './publicConfig';

const SEARCH_TIMEOUT_MS = 10000;
const MIN_QUERY_LEN = 2;

let cachedTenorKey = null;

export function getTenorApiKeyFromEnv() {
  return (process.env.REACT_APP_TENOR_API_KEY || '').trim();
}

export async function resolveTenorApiKey() {
  if (cachedTenorKey !== null) return cachedTenorKey;
  const envKey = getTenorApiKeyFromEnv();
  if (envKey) {
    cachedTenorKey = envKey;
    return envKey;
  }
  try {
    const cfg = await fetchPublicConfig();
    const key = (cfg?.gif_search?.tenor_api_key || '').trim();
    cachedTenorKey = key;
    return key;
  } catch {
    cachedTenorKey = '';
    return '';
  }
}

export function clearTenorApiKeyCache() {
  cachedTenorKey = null;
}

export function normalizeTenorResults(payload) {
  const rows = payload?.results || [];
  return rows.map((row) => {
    const formats = row.media_formats || {};
    const preview = formats.nanogif?.url || formats.tinygif?.url || formats.gif?.url || '';
    const full = formats.gif?.url || formats.mediumgif?.url || preview;
    return {
      id: row.id,
      title: row.title || row.content_description || '',
      previewUrl: preview,
      gifUrl: full,
    };
  }).filter((g) => g.gifUrl);
}

export async function searchTenorGifs(query, apiKey, { limit = 24 } = {}) {
  const q = (query || '').trim();
  if (!apiKey || q.length < MIN_QUERY_LEN) return [];
  const url = new URL('https://tenor.googleapis.com/v2/search');
  url.searchParams.set('q', q);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('client_key', 'ssc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('media_filter', 'gif');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return normalizeTenorResults(data);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGifBlob(gifUrl) {
  if (!gifUrl) throw new Error('gif_url_missing');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(gifUrl, { signal: controller.signal, credentials: 'omit' });
    if (!res.ok) throw new Error('gif_fetch_failed');
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}