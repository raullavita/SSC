/** In-app deep link routing without full WebView reload. */
const EVENT = 'ssc-deep-link';

export function dispatchDeepLink(path, search = '', hash = '') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { path, search, hash } }));
}

export function subscribeDeepLink(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}