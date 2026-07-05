/**
 * Client-side encrypted backup restore — Step 16.
 */

import { importAllIndexes } from '../search/messageIndex';
import {
  decryptBackupPayload,
  isForbiddenBackupKey,
  validateBackupEnvelope,
} from './backupCrypto';

const SSC_PREFIX = 'ssc_';
const PAYLOAD_FORMAT = 'ssc-backup-payload';

async function readFileText(file) {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function readBackupFile(file) {
  if (!file) throw new Error('No backup file selected');
  const text = await readFileText(file);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }
}

export function validateBackupPayload(payload) {
  if (!payload || payload.format !== PAYLOAD_FORMAT) {
    throw new Error('Invalid backup payload');
  }
  if (!payload.localStorage || typeof payload.localStorage !== 'object') {
    throw new Error('Backup payload missing local data');
  }
}

function clearSscLocalStorage() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().startsWith(SSC_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export function restoreLocalStorageSnapshot(snapshot, { replace = true } = {}) {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  if (replace) {
    clearSscLocalStorage();
  }
  let count = 0;
  for (const [key, value] of Object.entries(snapshot)) {
    if (!key.toLowerCase().startsWith(SSC_PREFIX)) continue;
    if (isForbiddenBackupKey(key)) continue;
    if (value === null || value === undefined) continue;
    try {
      localStorage.setItem(key, String(value));
      count += 1;
    } catch {
      /* quota */
    }
  }
  return count;
}

export async function restoreEncryptedBackup(file, passphrase, { replace = true } = {}) {
  const envelope = await readBackupFile(file);
  validateBackupEnvelope(envelope);
  const plaintext = await decryptBackupPayload(envelope, passphrase);
  let payload;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    throw new Error('Backup payload is corrupted');
  }
  validateBackupPayload(payload);

  const keysRestored = restoreLocalStorageSnapshot(payload.localStorage, { replace });
  const conversationsIndexed = importAllIndexes(payload.messageIndex);

  return {
    keysRestored,
    conversationsIndexed,
    exportedAt: payload.exported_at,
    userId: payload.user_id,
  };
}