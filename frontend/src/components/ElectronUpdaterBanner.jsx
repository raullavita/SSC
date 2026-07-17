import { useEffect, useState } from 'react';
import styles from './ElectronUpdaterBanner.module.css';

/**
 * Matches electron/main.js payloads: { status: 'available'|'downloaded'|'error', detail? }
 */
export default function ElectronUpdaterBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.sscUpdater) return undefined;

    window.sscUpdater.onStatus((payload) => {
      setStatus(payload || null);
    });

    return undefined;
  }, []);

  if (!status?.status || status.status === 'checking') return null;

  const ready = status.status === 'downloaded';
  const failed = status.status === 'error';
  let message = 'Checking for updates…';
  if (ready) {
    message = 'Update downloaded — restart to install the latest SSC version.';
  } else if (failed) {
    message = status.detail || status.message || 'Update check failed';
  } else if (status.status === 'available') {
    message = 'Update available — downloading…';
  } else if (status.message) {
    message = status.message;
  }

  return (
    <div className={styles.banner} role="status">
      <span>{message}</span>
      {ready && (
        <button type="button" className={styles.btn} onClick={() => window.sscUpdater.installUpdate()}>
          Restart &amp; install
        </button>
      )}
    </div>
  );
}
