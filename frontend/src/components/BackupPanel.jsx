import { useEffect, useRef, useState } from 'react';
import { createEncryptedBackup, downloadBackup } from '../lib/backupExport';
import { restoreEncryptedBackup } from '../lib/backupRestore';
import { MIN_PASSPHRASE_LENGTH } from '../lib/backupCrypto';
import {
  deleteCloudBackup,
  fetchCloudBackupMeta,
  restoreFromCloudBackup,
  uploadCloudBackup,
} from '../lib/cloudBackup';
import styles from './BackupPanel.module.css';

function formatCloudDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BackupPanel({ userId, onMessage }) {
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [cloudPassphrase, setCloudPassphrase] = useState('');
  const [cloudRestorePassphrase, setCloudRestorePassphrase] = useState('');
  const [cloudRestoreConfirm, setCloudRestoreConfirm] = useState('');
  const [cloudMeta, setCloudMeta] = useState({ hasBackup: false, updatedAt: null, sizeBytes: 0 });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function refreshCloudMeta() {
    try {
      const meta = await fetchCloudBackupMeta();
      setCloudMeta(meta);
    } catch {
      /* offline */
    }
  }

  useEffect(() => {
    refreshCloudMeta();
  }, []);

  async function handleExport() {
    if (exportPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      onMessage?.(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
      return;
    }
    setBusy(true);
    try {
      const result = await createEncryptedBackup({ passphrase: exportPassphrase, userId });
      downloadBackup(result.blob, result.filename);
      onMessage?.(
        `Backup saved (${result.keyCount} prefs, ${result.indexCount} indexes` +
          (result.signalFileCount ? `, ${result.signalFileCount} encryption files` : '') +
          ')'
      );
      setExportPassphrase('');
    } catch (err) {
      onMessage?.(err.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      onMessage?.('Choose a backup file first');
      return;
    }
    if (restorePassphrase.length < MIN_PASSPHRASE_LENGTH) {
      onMessage?.(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
      return;
    }
    if (restoreConfirm !== 'RESTORE') {
      onMessage?.('Type RESTORE to confirm');
      return;
    }
    setBusy(true);
    try {
      const result = await restoreEncryptedBackup(file, restorePassphrase, { replace: true });
      onMessage?.(
        `Restored ${result.keysRestored} prefs, ${result.conversationsIndexed} indexes` +
          (result.signalFilesRestored ? `, ${result.signalFilesRestored} encryption files` : '') +
          (result.exportedAt ? ` (from ${result.exportedAt})` : '')
      );
      setRestorePassphrase('');
      setRestoreConfirm('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      onMessage?.(err.message || 'Restore failed — check passphrase and file');
    } finally {
      setBusy(false);
    }
  }

  async function handleCloudUpload() {
    if (cloudPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      onMessage?.(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
      return;
    }
    setBusy(true);
    try {
      await uploadCloudBackup({ passphrase: cloudPassphrase, userId });
      await refreshCloudMeta();
      onMessage?.('Encrypted backup uploaded to cloud');
      setCloudPassphrase('');
    } catch (err) {
      onMessage?.(err.message || 'Cloud upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleCloudRestore() {
    if (cloudRestorePassphrase.length < MIN_PASSPHRASE_LENGTH) {
      onMessage?.(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
      return;
    }
    if (cloudRestoreConfirm !== 'RESTORE') {
      onMessage?.('Type RESTORE to confirm');
      return;
    }
    setBusy(true);
    try {
      const result = await restoreFromCloudBackup({ passphrase: cloudRestorePassphrase });
      onMessage?.(
        `Restored from cloud: ${result.keysRestored} prefs, ${result.conversationsIndexed} indexes` +
          (result.signalFilesRestored ? `, ${result.signalFilesRestored} encryption files` : '')
      );
      setCloudRestorePassphrase('');
      setCloudRestoreConfirm('');
    } catch (err) {
      onMessage?.(err.message || 'Cloud restore failed — check passphrase');
    } finally {
      setBusy(false);
    }
  }

  async function handleCloudDelete() {
    setBusy(true);
    try {
      await deleteCloudBackup();
      await refreshCloudMeta();
      onMessage?.('Cloud backup deleted');
    } catch (err) {
      onMessage?.(err.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>
        Export trust state, chat preferences, sender keys, and local search indexes. Backups are
        encrypted on this device with your passphrase before any file download or cloud upload.
      </p>

      <div className={styles.block}>
        <h3>Export backup</h3>
        <label className={styles.label}>
          <span>Passphrase</span>
          <input
            type="password"
            className={styles.input}
            value={exportPassphrase}
            onChange={(e) => setExportPassphrase(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </label>
        <button type="button" className={styles.primaryBtn} disabled={busy} onClick={handleExport}>
          {busy ? 'Working…' : 'Download encrypted backup'}
        </button>
      </div>

      <div className={styles.block}>
        <h3>Restore backup</h3>
        <label className={styles.label}>
          <span>Backup file (.ssc-backup)</span>
          <input ref={fileRef} type="file" accept=".ssc-backup,application/json" />
        </label>
        <label className={styles.label}>
          <span>Passphrase</span>
          <input
            type="password"
            className={styles.input}
            value={restorePassphrase}
            onChange={(e) => setRestorePassphrase(e.target.value)}
            placeholder="Same passphrase used for export"
            autoComplete="current-password"
          />
        </label>
        <label className={styles.label}>
          <span>Type RESTORE to confirm (replaces local SSC data)</span>
          <input
            type="text"
            className={styles.input}
            value={restoreConfirm}
            onChange={(e) => setRestoreConfirm(e.target.value)}
            placeholder="RESTORE"
          />
        </label>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={busy || restoreConfirm !== 'RESTORE'}
          onClick={handleRestore}
        >
          {busy ? 'Working…' : 'Restore from backup'}
        </button>
      </div>

      <div className={styles.block}>
        <h3>Cloud backup (encrypted)</h3>
        <p className={styles.hint}>
          Optional free cloud copy — same encrypted blob as a local file. SSC servers store
          ciphertext only; your passphrase never leaves this device.
        </p>
        {cloudMeta.hasBackup ? (
          <p className={styles.cloudMeta}>
            Cloud copy: {formatCloudDate(cloudMeta.updatedAt)}
            {cloudMeta.sizeBytes ? ` · ${Math.round(cloudMeta.sizeBytes / 1024)} KB` : ''}
          </p>
        ) : (
          <p className={styles.cloudMeta}>No cloud copy yet.</p>
        )}
        <label className={styles.label}>
          <span>Passphrase for upload</span>
          <input
            type="password"
            className={styles.input}
            value={cloudPassphrase}
            onChange={(e) => setCloudPassphrase(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </label>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={handleCloudUpload}
        >
          {busy ? 'Working…' : cloudMeta.hasBackup ? 'Replace cloud backup' : 'Upload to cloud'}
        </button>

        {cloudMeta.hasBackup && (
          <>
            <label className={styles.label}>
              <span>Passphrase to restore from cloud</span>
              <input
                type="password"
                className={styles.input}
                value={cloudRestorePassphrase}
                onChange={(e) => setCloudRestorePassphrase(e.target.value)}
                placeholder="Same passphrase used for upload"
                autoComplete="current-password"
              />
            </label>
            <label className={styles.label}>
              <span>Type RESTORE to confirm</span>
              <input
                type="text"
                className={styles.input}
                value={cloudRestoreConfirm}
                onChange={(e) => setCloudRestoreConfirm(e.target.value)}
                placeholder="RESTORE"
              />
            </label>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy || cloudRestoreConfirm !== 'RESTORE'}
              onClick={handleCloudRestore}
            >
              {busy ? 'Working…' : 'Restore from cloud'}
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy}
              onClick={handleCloudDelete}
            >
              Delete cloud backup
            </button>
          </>
        )}
      </div>
    </div>
  );
}