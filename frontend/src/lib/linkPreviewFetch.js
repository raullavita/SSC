/**
 * Client-side link preview fetch + session cache — Q.16.
 */
import {
  buildUrlFallbackPreview,
  mergePreviewData,
  normalizePreviewUrl,
  parseOpenGraphFromHtml,
} from './linkPreview';

const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;

const cache = new Map();

export function clearLinkPreviewCache() {
  cache.clear();
}

function cacheGet(url) {
  const row = cache.get(url);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  return row.data;
}

function cacheSet(url, data) {
  cache.set(url, { data, at: Date.now() });
}

export async function fetchLinkPreviewClient(rawUrl) {
  const url = normalizePreviewUrl(rawUrl);
  if (!url) return null;

  const cached = cacheGet(url);
  if (cached) return cached;

  const fallback = buildUrlFallbackPreview(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
    });
    if (!res.ok) {
      cacheSet(url, fallback);
      return fallback;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      cacheSet(url, fallback);
      return fallback;
    }
    const text = (await res.text()).slice(0, MAX_HTML_BYTES);
    const parsed = parseOpenGraphFromHtml(text, url);
    const merged = mergePreviewData(fallback, parsed);
    cacheSet(url, merged);
    return merged;
  } catch {
    cacheSet(url, fallback);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}