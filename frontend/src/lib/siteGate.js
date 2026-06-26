const BYPASS_KEY = 'ssc_site_preview';
const BYPASS_SESSION_KEY = 'ssc_site_preview_session';

/** Public marketing site shows the construction gate when true (build-time env). */
export function isSiteUnderConstruction() {
  const raw = process.env.REACT_APP_SITE_UNDER_CONSTRUCTION;
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  return process.env.NODE_ENV === 'production';
}

export function hasSiteAccessBypass() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(BYPASS_SESSION_KEY) === '1'
      || window.localStorage.getItem(BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSiteAccessBypass({ persist = false } = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(BYPASS_SESSION_KEY, '1');
    if (persist) window.localStorage.setItem(BYPASS_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/** Bookmarkable preview link: ?preview=<REACT_APP_SITE_PREVIEW_KEY> */
export function tryUrlPreviewBypass() {
  if (typeof window === 'undefined') return false;
  const secret = process.env.REACT_APP_SITE_PREVIEW_KEY || '';
  if (!secret) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') !== secret) return false;
  setSiteAccessBypass({ persist: true });
  const url = new URL(window.location.href);
  url.searchParams.delete('preview');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}