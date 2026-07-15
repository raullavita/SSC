/**
 * Native Signal protocol store export/import for encrypted backups.
 */

export async function exportNativeSignalStore() {
  if (typeof window === 'undefined' || !window.sscCrypto?.exportSignalStore) {
    return null;
  }
  try {
    const result = await window.sscCrypto.exportSignalStore();
    if (!result?.files || !Object.keys(result.files).length) return null;
    return result;
  } catch {
    return null;
  }
}

export async function importNativeSignalStore(files) {
  if (typeof window === 'undefined' || !window.sscCrypto?.importSignalStore) {
    return { imported: 0, skipped: true };
  }
  if (!files || !Object.keys(files).length) {
    return { imported: 0, skipped: true };
  }
  return window.sscCrypto.importSignalStore(files);
}