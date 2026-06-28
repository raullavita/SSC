const BYPASS_KEY = 'ssc_site_preview';
const BYPASS_SESSION_KEY = 'ssc_site_preview_session';
const FAIL_KEY = 'ssc_site_preview_fails';
const LOCK_KEY = 'ssc_site_preview_locked_until';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Public marketing site shows under-construction copy (no downloads / no beta) when true.
 * Does NOT imply a password wall — see isSitePreviewGateEnabled().
 */
export function isSiteUnderConstruction() {
  const raw = process.env.REACT_APP_SITE_UNDER_CONSTRUCTION;
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  return process.env.NODE_ENV === 'production';
}

/** Alias for landing — public visitors see the site, but in construction mode. */
export function isSitePublicConstructionMode() {
  return isSiteUnderConstruction();
}

/**
 * Optional founder preview password wall (full marketing page behind a code).
 * Off by default after Q.1 — set REACT_APP_SITE_PREVIEW_GATE=true to re-enable.
 */
export function isSitePreviewGateEnabled() {
  const raw = process.env.REACT_APP_SITE_PREVIEW_GATE;
  if (raw !== 'true' && raw !== '1') return false;
  return isSitePreviewAccessConfigured();
}

function getSitePreviewPassword() {
  return process.env.REACT_APP_SITE_PREVIEW_PASSWORD
    || process.env.REACT_APP_SITE_PREVIEW_KEY
    || '';
}

export function isSitePreviewAccessConfigured() {
  return getSitePreviewPassword().length > 0;
}

export function isSitePreviewLocked() {
  if (typeof window === 'undefined') return false;
  try {
    const until = Number(window.sessionStorage.getItem(LOCK_KEY) || '0');
    if (!until) return false;
    if (Date.now() < until) return true;
    window.sessionStorage.removeItem(LOCK_KEY);
    window.sessionStorage.removeItem(FAIL_KEY);
    return false;
  } catch {
    return false;
  }
}

function registerFailedPreviewAttempt() {
  if (typeof window === 'undefined') return;
  try {
    const fails = Number(window.sessionStorage.getItem(FAIL_KEY) || '0') + 1;
    window.sessionStorage.setItem(FAIL_KEY, String(fails));
    if (fails >= MAX_ATTEMPTS) {
      window.sessionStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS));
    }
  } catch {
    /* ignore */
  }
}

function clearFailedPreviewAttempts() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FAIL_KEY);
    window.sessionStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function verifySitePreviewPassword(input) {
  if (isSitePreviewLocked()) return false;
  const expected = getSitePreviewPassword();
  if (!expected || !input) return false;
  const ok = input.trim() === expected;
  if (ok) {
    clearFailedPreviewAttempts();
    return true;
  }
  registerFailedPreviewAttempt();
  return false;
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

/** Bookmark for invitees: ?access=<password> (same value as REACT_APP_SITE_PREVIEW_PASSWORD) */
export function tryUrlPreviewBypass() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('access') || params.get('preview');
  if (!candidate || !verifySitePreviewPassword(candidate)) return false;
  setSiteAccessBypass({ persist: true });
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('access');
    url.searchParams.delete('preview');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
  return true;
}