/** Opt-in GIF search (Tenor) — Q.22 network toggle, local only. */

const STORAGE_KEY = 'ssc_gif_search_enabled';
const listeners = new Set();

export function gifSearchEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGifSearchEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(!!enabled));
}

export function subscribeGifSearchPrefs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}