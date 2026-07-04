import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMultiDevice } from '../devices/useMultiDevice';
import { getInstalledClientHeader } from '../lib/installedClient';
import styles from './Settings.module.css';

function detectPlatform() {
  const header = getInstalledClientHeader();
  if (header.startsWith('android')) return 'android';
  if (header.startsWith('electron') || header.startsWith('windows')) return 'electron';
  return 'electron';
}

export default function DeviceLink() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { confirmLink, loading: linking, error } = useMultiDevice();
  const [done, setDone] = useState(false);
  const [deviceName, setDeviceName] = useState('Linked device');

  useEffect(() => {
    if (!user || !token || done) return;
    const deviceId = `linked-${Date.now()}`;
    confirmLink({
      linkToken: token,
      deviceId,
      name: deviceName,
      platform: detectPlatform(),
    }).then((result) => {
      if (result?.ok) setDone(true);
    });
  }, [user, token, confirmLink, deviceName, done]);

  if (!loading && !user) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/link-device?token=${token}`)}`} replace />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/settings" className={styles.back}>
          ← Settings
        </Link>
        <h1>Link device</h1>
      </header>
      <section className={styles.section}>
        {!token && <p className={styles.hint}>Missing link token. Generate a link from Settings on your primary device.</p>}
        {token && !done && (
          <>
            <label className={styles.rowStack}>
              <span>Device name</span>
              <input
                className={styles.textInput}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </label>
            <p className={styles.hint}>{linking ? 'Linking this device…' : 'Confirming secure link…'}</p>
          </>
        )}
        {done && <p className={styles.toast}>Device linked. You can open chat now.</p>}
        {error && <p className={styles.hint}>{error}</p>}
        {done && (
          <Link className={styles.back} to="/chat">
            Open chat →
          </Link>
        )}
      </section>
    </div>
  );
}