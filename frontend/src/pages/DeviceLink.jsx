import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMultiDevice } from '../devices/useMultiDevice';
import { getLocalDeviceId, parseDeviceLinkToken, platformLabel } from '../lib/deviceLink';
import { getInstalledClientHeader } from '../lib/installedClient';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';
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
  const queryToken = params.get('token') || '';
  const { confirmLink, loading: linking, error } = useMultiDevice();
  const [done, setDone] = useState(false);
  const [deviceName, setDeviceName] = useState('Linked device');
  const [pasteToken, setPasteToken] = useState('');
  const [status, setStatus] = useState('');

  const token = useMemo(
    () => parseDeviceLinkToken(queryToken) || parseDeviceLinkToken(pasteToken),
    [queryToken, pasteToken]
  );

  if (!loading && !user) {
    const next = token ? `/link-device?token=${encodeURIComponent(token)}` : '/link-device';
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  async function handleLinkDevice() {
    if (!token) return;
    setStatus('Linking device…');
    const deviceId = getLocalDeviceId();
    const platform = detectPlatform();
    const result = await confirmLink({
      linkToken: token,
      deviceId,
      name: deviceName.trim() || 'Linked device',
      platform,
    });
    if (!result?.ok) {
      setStatus('');
      return;
    }
    setStatus('Registering encryption keys…');
    try {
      await registerDeviceAndPrekeys({
        deviceId,
        deviceName: deviceName.trim() || 'Linked device',
        platform,
      });
    } catch {
      /* prekeys optional in dev */
    }
    setDone(true);
    setStatus('');
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
        {!token && (
          <>
            <p className={styles.hint}>
              Scan the QR code from Settings on your primary device, or paste the link token below.
            </p>
            <label className={styles.rowStack}>
              <span>Link token or URL</span>
              <input
                className={styles.textInput}
                value={pasteToken}
                onChange={(e) => setPasteToken(e.target.value)}
                placeholder="Paste link or ssc://link-device?token=…"
              />
            </label>
          </>
        )}

        {token && !done && (
          <>
            <p className={styles.hint}>
              You are linking this {platformLabel(detectPlatform())} device to your SSC account.
              Confirm the name below, then link.
            </p>
            <label className={styles.rowStack}>
              <span>Device name</span>
              <input
                className={styles.textInput}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.logout}
              disabled={linking || !deviceName.trim()}
              onClick={handleLinkDevice}
            >
              {linking ? 'Linking…' : 'Link this device'}
            </button>
            {status && <p className={styles.hint}>{status}</p>}
          </>
        )}

        {done && (
          <>
            <p className={styles.toast}>
              Device linked. Messages will sync in real time across your linked devices.
            </p>
            <Link className={styles.back} to="/chat">
              Open chat →
            </Link>
          </>
        )}

        {error && <p className={styles.hint}>{error}</p>}
      </section>
    </div>
  );
}