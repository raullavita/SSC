/**
 * Link previews — disabled by default (privacy).
 * SSC never fetches URLs server-side; optional client opt-in only.
 */

import { getLinkPreviewsEnabled } from './chatPrefs';

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const MAX_PREVIEWS_PER_MESSAGE = 3;
const FETCH_TIMEOUT_MS = 5000;

function extractUrls(text) {
  if (!text) return [];
  const seen = new Set();
  const urls = [];
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0].replace(/[),.!?;:]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function metaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parsePreviewFromHtml(html, url) {
  const hostname = hostnameFromUrl(url);
  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
    hostname;
  const description =
    metaContent(html, 'og:description') || metaContent(html, 'twitter:description') || null;
  const image = metaContent(html, 'og:image') || metaContent(html, 'twitter:image') || null;
  return { url, hostname, title, description, image, limited: false };
}

function fallbackPreview(url) {
  const hostname = hostnameFromUrl(url);
  return { url, hostname, title: hostname, description: null, image: null, limited: true };
}

async function maybeFetchLinkPreview(url) {
  if (!getLinkPreviewsEnabled()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) return fallbackPreview(url);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return fallbackPreview(url);
    const html = await response.text();
    return parsePreviewFromHtml(html.slice(0, 200_000), url);
  } catch {
    return fallbackPreview(url);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPreviewsForText(text) {
  if (!getLinkPreviewsEnabled() || !text) return [];
  const urls = extractUrls(text).slice(0, MAX_PREVIEWS_PER_MESSAGE);
  const previews = await Promise.all(urls.map((url) => maybeFetchLinkPreview(url)));
  return previews.filter(Boolean);
}