import { useRef, useState } from 'react';
import { createEncryptedBackup, downloadBackup } from '../lib/backupExport';
import { restoreEncryptedBackup } from '../lib/backupRestore';
import { MIN_PASSPHRASE_LENGTH } from '../lib/backupCrypto';
import styles from './BackupPanel.module.css';

export default function BackupPanel({ userId, onMessage }) {
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

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
          (result.signalFileCount
            ? `, ${result.signalFileCount} encryption files`
            : '') +
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
          (result.signalFilesRestored
            ? `, ${result.signalFilesRestored} encryption files`
            : '') +
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

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>
        Export trust state, chat preferences, sender keys, and local search indexes. Encrypted on
        this device with your passphrase — never uploaded to SSC servers.
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
    </div>
  );
}