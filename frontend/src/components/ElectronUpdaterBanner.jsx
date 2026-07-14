import { useEffect, useState } from 'react';
import styles from './ElectronUpdaterBanner.module.css';

export default function ElectronUpdaterBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.sscUpdater) return undefined;

    window.sscUpdater.onStatus((payload) => {
      setStatus(payload || null);
    });

    return undefined;
  }, []);

  if (!status || status.type === 'checking') return null;

  const ready = status.type === 'update-downloaded';

  return (
    <div className={styles.banner} role="status">
      <span>
        {ready
          ? 'Update downloaded — restart to install the latest SSC version.'
          : status.message || 'Checking for updates…'}
      </span>
      {ready && (
        <button type="button" className={styles.btn} onClick={() => window.sscUpdater.installUpdate()}>
          Restart &amp; install
        </button>
      )}
    </div>
  );
}