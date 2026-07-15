/**
 * Client-side encrypted backup export — Step 16.
 */

import { exportAllIndexes } from '../search/messageIndex';
import { exportNativeSignalStore } from './signalStoreBackup';
import {
  BACKUP_FILE_EXTENSION,
  encryptBackupPayload,
  isForbiddenBackupKey,
} from './backupCrypto';

const SSC_PREFIX = 'ssc_';
const BACKUP_FORMAT_INNER = 'ssc-backup-payload';

function collectLocalStorageSnapshot() {
  const snapshot = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.toLowerCase().startsWith(SSC_PREFIX)) continue;
      if (isForbiddenBackupKey(key)) continue;
      snapshot[key] = localStorage.getItem(key);
    }
  } catch {
    /* ignore */
  }
  return snapshot;
}

async function buildBackupPayload({ userId } = {}) {
  const signalStore = await exportNativeSignalStore();
  return {
    format: BACKUP_FORMAT_INNER,
    version: 2,
    exported_at: new Date().toISOString(),
    user_id: userId || null,
    localStorage: collectLocalStorageSnapshot(),
    messageIndex: exportAllIndexes(),
    signalStore: signalStore?.files || null,
  };
}

export async function createEncryptedBackup({ passphrase, userId } = {}) {
  const payload = await buildBackupPayload({ userId });
  const envelope = await encryptBackupPayload(JSON.stringify(payload), passphrase);
  const date = payload.exported_at.slice(0, 10);
  return {
    filename: `ssc-backup-${date}${BACKUP_FILE_EXTENSION}`,
    blob: new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }),
    keyCount: Object.keys(payload.localStorage).length,
    indexCount: Object.keys(payload.messageIndex).length,
    signalFileCount: payload.signalStore ? Object.keys(payload.signalStore).length : 0,
  };
}

export function downloadBackup(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}