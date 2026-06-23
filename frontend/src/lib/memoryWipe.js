/**
 * Client footprint wipe — Engine 3 Steps 3.2–3.5.
 * Revokes blob URLs, closes sockets, purges SW caches, IndexedDB, decrypted React state.
 */
import { purgeIndexedDBFootprint } from './indexedDBFootprint';
import { applyLocalStoragePanicPolicy } from './localStorageFootprint';
import { purgeServiceWorkerCaches } from './serviceWorkerCache';

export const MEMORY_WIPE_EVENT = 'ssc-memory-wipe';

const blobUrls = new Set();
const wipeHandlers = new Set();
const socketClosers = new Set();

export function registerBlobUrl(url) {
  if (url) blobUrls.add(url);
}

export function unregisterBlobUrl(url) {
  if (!url) return;
  blobUrls.delete(url);
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

export function revokeAllBlobUrls() {
  for (const url of blobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  blobUrls.clear();
}

/** Register a callback to clear component-local decrypted state. Returns unsubscribe. */
export function registerMemoryWipeHandler(fn) {
  wipeHandlers.add(fn);
  return () => wipeHandlers.delete(fn);
}

/** Register socket teardown (ChatSocket.close). Returns unsubscribe. */
export function registerSocketCloser(fn) {
  socketClosers.add(fn);
  return () => socketClosers.delete(fn);
}

function closeAllSockets() {
  for (const fn of socketClosers) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function runWipeHandlers(reason) {
  for (const fn of wipeHandlers) {
    try {
      fn(reason);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Synchronous in-memory wipe — call before logout redirect or panic server round-trip.
 * @param {'logout'|'panic'} reason
 */
export function dispatchMemoryWipe(reason = 'logout') {
  closeAllSockets();
  revokeAllBlobUrls();
  runWipeHandlers(reason);
  applyLocalStoragePanicPolicy(reason);
  purgeServiceWorkerCaches().catch(() => {});
  purgeIndexedDBFootprint().catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MEMORY_WIPE_EVENT, { detail: { reason } }));
  }
}

/** Subscribe to wipe events in React components. Returns unsubscribe. */
export function subscribeMemoryWipe(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (ev) => callback(ev.detail?.reason);
  window.addEventListener(MEMORY_WIPE_EVENT, handler);
  return () => window.removeEventListener(MEMORY_WIPE_EVENT, handler);
}