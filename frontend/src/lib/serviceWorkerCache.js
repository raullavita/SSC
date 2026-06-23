/**
 * Service worker cache purge — Engine 3 Step 3.3.
 * Deletes all Cache Storage entries (including ssc-v1) on panic/logout.
 */
export const SW_PURGE_CACHES_MESSAGE = 'SSC_PURGE_CACHES';
export const SSC_CACHE_NAME = 'ssc-v1';

/**
 * Purge all caches from the page context and ask the active service worker to do the same.
 * Fire-and-forget safe — never throws.
 */
export async function purgeServiceWorkerCaches() {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const target = navigator.serviceWorker.controller || reg?.active;
      target?.postMessage({ type: SW_PURGE_CACHES_MESSAGE });
    }
  } catch {
    /* ignore */
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignore */
  }
}