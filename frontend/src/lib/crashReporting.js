/**
 * Q.59 — Opt-in crash reporting (off by default).
 * Android → Firebase Crashlytics when configured.
 * Desktop → Sentry when REACT_APP_SENTRY_DSN is set.
 * Never sends message plaintext, keys, or passwords.
 */
import { isElectronApp, isInstalledClient, isNativeApp } from './platform';

export const CRASH_REPORTING_STORAGE_KEY = 'ssc_crash_reporting_opt_in';

const FORBIDDEN_DETAIL_KEYS = [
  'password',
  'token',
  'jwt',
  'private_key',
  'ciphertext',
  'plaintext',
  'message',
  'secret',
];

let handlersInstalled = false;
let sentryInitPromise = null;

function readStoredOptIn() {
  try {
    return localStorage.getItem(CRASH_REPORTING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isCrashReportingOptedIn() {
  return readStoredOptIn();
}

export function setCrashReportingOptIn(enabled) {
  const on = !!enabled;
  try {
    if (on) localStorage.setItem(CRASH_REPORTING_STORAGE_KEY, '1');
    else localStorage.removeItem(CRASH_REPORTING_STORAGE_KEY);
  } catch {
    /* private mode */
  }
  return Promise.all([
    syncNativeCrashReporting(on),
    syncDesktopCrashReporting(on),
  ]).finally(() => {
    if (on) return enableCrashReporting();
    return disableCrashReporting();
  });
}

function scrubText(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  FORBIDDEN_DETAIL_KEYS.forEach((key) => {
    out = out.replace(new RegExp(`${key}[=:]\\s*\\S+`, 'gi'), `${key}=[redacted]`);
  });
  return out;
}

export function scrubErrorForReport(error) {
  const message = scrubText(error?.message || String(error || 'unknown'));
  const stack = scrubText(error?.stack || '');
  return { message, stack };
}

async function syncNativeCrashReporting(enabled) {
  if (!isNativeApp()) return;
  try {
    const { syncCrashReportingOptIn } = await import('./crashReportingNative');
    await syncCrashReportingOptIn(enabled);
  } catch {
    /* native bridge optional */
  }
}

async function syncDesktopCrashReporting(enabled) {
  if (!isElectronApp() || !window.sscDesktop?.crashReporting) return;
  try {
    await window.sscDesktop.crashReporting.setOptIn(!!enabled);
  } catch {
    /* optional */
  }
}

async function forwardToNative(error) {
  if (!isNativeApp()) return;
  try {
    const { recordNativeCrash } = await import('./crashReportingNative');
    const scrubbed = scrubErrorForReport(error);
    await recordNativeCrash(scrubbed);
  } catch {
    /* optional */
  }
}

async function forwardToDesktop(error) {
  if (!isElectronApp() || !window.sscDesktop?.crashReporting) return;
  const scrubbed = scrubErrorForReport(error);
  try {
    await window.sscDesktop.crashReporting.record(scrubbed);
  } catch {
    /* optional */
  }
}

async function initSentryIfConfigured() {
  const dsn = (process.env.REACT_APP_SENTRY_DSN || '').trim();
  if (!dsn || sentryInitPromise) return sentryInitPromise;
  sentryInitPromise = (async () => {
    try {
      const Sentry = await import('@sentry/react');
      Sentry.init({
        dsn,
        enabled: true,
        environment: process.env.NODE_ENV || 'production',
        beforeSend(event) {
          if (event.request?.headers) delete event.request.headers.Authorization;
          if (event.user) {
            delete event.user.email;
            delete event.user.username;
          }
          return event;
        },
      });
      return Sentry;
    } catch {
      return null;
    }
  })();
  return sentryInitPromise;
}

export async function captureCrash(error, context = {}) {
  if (!isCrashReportingOptedIn()) return { skipped: true, reason: 'opt_out' };
  const scrubbed = scrubErrorForReport(error);
  await forwardToNative(error);
  await forwardToDesktop(error);

  if (isElectronApp() || process.env.REACT_APP_SENTRY_DSN) {
    const Sentry = await initSentryIfConfigured();
    if (Sentry?.captureException) {
      Sentry.captureException(error, { extra: scrubbed, contexts: { ssc: context } });
      return { sent: true, provider: 'sentry' };
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SSC crash reporting]', scrubbed.message);
  }
  return { sent: false, provider: 'native_or_none' };
}

function onGlobalError(event) {
  const err = event?.error || new Error(event?.message || 'window error');
  void captureCrash(err, { source: 'window.onerror' });
}

function onUnhandledRejection(event) {
  const reason = event?.reason;
  const err = reason instanceof Error ? reason : new Error(String(reason || 'unhandled rejection'));
  void captureCrash(err, { source: 'unhandledrejection' });
}

export async function enableCrashReporting() {
  if (!isCrashReportingOptedIn()) return;
  if (!handlersInstalled) {
    window.addEventListener('error', onGlobalError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    handlersInstalled = true;
  }
  await Promise.all([syncNativeCrashReporting(true), syncDesktopCrashReporting(true)]);
  if (isElectronApp() || process.env.REACT_APP_SENTRY_DSN) {
    await initSentryIfConfigured();
  }
}

export async function disableCrashReporting() {
  if (handlersInstalled) {
    window.removeEventListener('error', onGlobalError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    handlersInstalled = false;
  }
  await Promise.all([syncNativeCrashReporting(false), syncDesktopCrashReporting(false)]);
}

export async function initCrashReportingFromStorage() {
  if (isCrashReportingOptedIn()) {
    await enableCrashReporting();
  }
}

export function crashReportingProviderLabel() {
  if (isNativeApp()) return 'Firebase Crashlytics';
  if (isElectronApp()) return 'Sentry';
  return 'none';
}