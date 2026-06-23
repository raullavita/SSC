/**
 * IndexedDB footprint — Engine 3 Step 3.5.
 * Audit 2026-06-23: no SSC-owned databases in app source; purge all at runtime.
 */
export const INDEXEDDB_AUDIT_DATE = '2026-06-23';

/** Reserved for future SSC-owned stores — empty today. */
export const SSC_OWNED_INDEXEDDB_NAMES = [];

/** Fallback when indexedDB.databases() is unavailable (older WebViews). */
export const THIRD_PARTY_INDEXEDDB_CANDIDATES = [
  'workbox-expiration',
  'workbox-background-sync',
];

function deleteDatabase(name) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Delete every IndexedDB database visible to this origin.
 * Fire-and-forget safe — never throws.
 */
export async function purgeIndexedDBFootprint() {
  if (typeof indexedDB === 'undefined') return;

  const names = new Set([...SSC_OWNED_INDEXEDDB_NAMES, ...THIRD_PARTY_INDEXEDDB_CANDIDATES]);

  try {
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      for (const db of dbs || []) {
        if (db?.name) names.add(db.name);
      }
    }
  } catch {
    /* ignore */
  }

  await Promise.all([...names].map((name) => deleteDatabase(name)));
}