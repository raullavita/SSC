/**
 * Client-side encrypted backup export — Step 16.
 */

import { exportAllIndexes } from '../search/messageIndex';
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

function buildBackupPayload({ userId } = {}) {
  return {
    format: BACKUP_FORMAT_INNER,
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: userId || null,
    localStorage: collectLocalStorageSnapshot(),
    messageIndex: exportAllIndexes(),
  };
}

export async function createEncryptedBackup({ passphrase, userId } = {}) {
  const payload = buildBackupPayload({ userId });
  const envelope = await encryptBackupPayload(JSON.stringify(payload), passphrase);
  const date = payload.exported_at.slice(0, 10);
  return {
    filename: `ssc-backup-${date}${BACKUP_FILE_EXTENSION}`,
    blob: new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }),
    keyCount: Object.keys(payload.localStorage).length,
    indexCount: Object.keys(payload.messageIndex).length,
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