/** Opt-in link preview preference — Q.16 (local only, no server plaintext). */

const STORAGE_KEY = 'ssc_link_previews_enabled';
const listeners = new Set();

export function linkPreviewsEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLinkPreviewsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(!!enabled));
}

export function subscribeLinkPreviewPrefs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}