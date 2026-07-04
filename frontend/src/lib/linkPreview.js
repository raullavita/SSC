/**
 * Link previews — disabled by default (privacy).
 * SSC never fetches URLs server-side; optional client opt-in only.
 */

import { getLinkPreviewsEnabled } from './chatPrefs';

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

export function extractUrls(text) {
  if (!text) return [];
  return [...text.matchAll(URL_RE)].map((m) => m[0]);
}

export async function maybeFetchLinkPreview(url) {
  if (!getLinkPreviewsEnabled()) return null;
  // Client-side fetch is opt-in; many sites block CORS — show URL only.
  return { url, title: null, disabled: true };
}