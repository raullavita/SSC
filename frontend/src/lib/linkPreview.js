/**
 * Link preview helpers — Q.16 (client-side only).
 */

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

const HTML_ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  '#x27': "'",
};

export function decodeHtmlEntities(value = '') {
  return String(value).replace(/&(#x27|#39|amp|lt|gt|quot);/gi, (entity, name) => {
    const key = name.toLowerCase();
    return HTML_ENTITY_MAP[key] ?? entity;
  });
}

export function normalizePreviewUrl(rawUrl) {
  if (!rawUrl) return null;
  let candidate = String(rawUrl).trim().replace(/[),.!?;:]+$/g, '');
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (PRIVATE_HOST_RE.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractFirstPreviewUrl(text) {
  if (!text) return null;
  const matches = String(text).match(URL_PATTERN);
  if (!matches?.length) return null;
  for (const raw of matches) {
    const normalized = normalizePreviewUrl(raw);
    if (normalized) return normalized;
  }
  return null;
}

export function buildUrlFallbackPreview(url) {
  const parsed = new URL(url);
  const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
  return {
    url,
    title: parsed.hostname,
    description: `${parsed.hostname}${path}`.slice(0, 120),
    image: null,
    siteName: parsed.hostname,
    fetched: false,
  };
}

function metaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function resolvePreviewImage(rawImage, baseUrl) {
  if (!rawImage) return null;
  try {
    return new URL(rawImage, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parseOpenGraphFromHtml(html, baseUrl) {
  if (!html) return {};
  const title = metaContent(html, 'og:title')
    || metaContent(html, 'twitter:title')
    || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
  const description = metaContent(html, 'og:description')
    || metaContent(html, 'twitter:description')
    || metaContent(html, 'description');
  const image = resolvePreviewImage(
    metaContent(html, 'og:image') || metaContent(html, 'twitter:image'),
    baseUrl,
  );
  const siteName = metaContent(html, 'og:site_name');
  return {
    title: title ? decodeHtmlEntities(title) : null,
    description: description ? decodeHtmlEntities(description) : null,
    image,
    siteName: siteName ? decodeHtmlEntities(siteName) : null,
  };
}

export function mergePreviewData(fallback, parsed) {
  return {
    ...fallback,
    title: parsed.title || fallback.title,
    description: parsed.description || fallback.description,
    image: parsed.image || fallback.image,
    siteName: parsed.siteName || fallback.siteName,
    fetched: true,
  };
}