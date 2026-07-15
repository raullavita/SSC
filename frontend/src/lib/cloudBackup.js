/**
 * Encrypted cloud backup — same client encryption as local .ssc-backup; server stores ciphertext only.
 */

import { api } from './api';
import { createEncryptedBackup } from './backupExport';
import { restoreEncryptedBackup } from './backupRestore';

export async function fetchCloudBackupMeta() {
  const data = await api.get('/api/backup/cloud');
  return {
    hasBackup: Boolean(data.has_backup),
    updatedAt: data.backup?.updated_at || null,
    sizeBytes: data.backup?.size_bytes || 0,
  };
}

export async function uploadCloudBackup({ passphrase, userId }) {
  const result = await createEncryptedBackup({ passphrase, userId });
  const ciphertext = await result.blob.text();
  return api.put('/api/backup/cloud', { ciphertext });
}

export async function downloadCloudBackupCiphertext() {
  const data = await api.get('/api/backup/cloud');
  if (!data.has_backup || !data.backup?.ciphertext) {
    throw new Error('cloud_backup_not_found');
  }
  return data.backup;
}

export async function restoreFromCloudBackup({ passphrase }) {
  const backup = await downloadCloudBackupCiphertext();
  const blob = new Blob([backup.ciphertext], { type: 'application/json' });
  const file = new File([blob], 'ssc-cloud-backup.ssc-backup', { type: 'application/json' });
  return restoreEncryptedBackup(file, passphrase, { replace: true });
}

export async function deleteCloudBackup() {
  return api.delete('/api/backup/cloud');
}