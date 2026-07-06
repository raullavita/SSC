import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import LinkedDevicesPanel from '../components/LinkedDevicesPanel';
import { useAuth } from '../context/AuthContext';
import { useMultiDevice } from '../devices/useMultiDevice';
import { getLocalDeviceId, parseDeviceLinkToken, platformLabel } from '../lib/deviceLink';
import { getInstalledClientHeader } from '../lib/installedClient';
import { needsUsernameSetup } from '../lib/onboarding';
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
  const {
    devices,
    linkSession,
    createLink,
    confirmLink,
    loadDevices,
    revokeDevice,
    loading: deviceLoading,
    error,
  } = useMultiDevice();
  const [done, setDone] = useState(false);
  const [deviceName, setDeviceName] = useState('Linked device');
  const [pasteToken, setPasteToken] = useState('');
  const [linkLabel, setLinkLabel] = useState('New device');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState(null);

  const token = useMemo(
    () => parseDeviceLinkToken(queryToken) || parseDeviceLinkToken(pasteToken),
    [queryToken, pasteToken]
  );

  useEffect(() => {
    if (!user) return;
    loadDevices();
  }, [user, loadDevices]);

  if (!loading && !user) {
    const next = token ? `/link-device?token=${encodeURIComponent(token)}` : '/link-device';
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!loading && user && needsUsernameSetup(user)) {
    return <Navigate to="/setup-username" replace />;
  }
  if (loading) return <div className={styles.page}>Loading…</div>;

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
    setMessage('Device linked');
    await loadDevices();
  }

  async function handleCreateLink() {
    setMessage(null);
    await createLink(linkLabel.trim() || 'New device');
  }

  async function handleRevoke(deviceId) {
    const device = devices.find((entry) => entry.id === deviceId);
    const label = device?.name || 'this device';
    if (!window.confirm(`Revoke ${label}? It will stop receiving messages on that device.`)) {
      return;
    }
    const ok = await revokeDevice(deviceId);
    if (ok) setMessage('Device revoked');
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/chat" className={styles.back}>
          ← Chats
        </Link>
        <h1>Linked devices</h1>
      </header>

      {token && !done && (
        <section className={styles.section}>
          <h2>Link this device</h2>
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
            disabled={deviceLoading || !deviceName.trim()}
            onClick={handleLinkDevice}
          >
            {deviceLoading ? 'Linking…' : 'Link this device'}
          </button>
          {status && <p className={styles.hint}>{status}</p>}
        </section>
      )}

      {done && (
        <section className={styles.section}>
          <p className={styles.toast}>
            Device linked. Messages will sync in real time across your linked devices.
          </p>
          <Link className={styles.back} to="/chat">
            Open chat →
          </Link>
        </section>
      )}

      <section className={styles.section}>
        <h2>Your devices</h2>
        <LinkedDevicesPanel
          devices={devices}
          linkSession={linkSession}
          linkLabel={linkLabel}
          onLinkLabelChange={setLinkLabel}
          onCreateLink={handleCreateLink}
          onRevoke={handleRevoke}
          loading={deviceLoading}
          error={error}
          onMessage={setMessage}
        />
      </section>

      {!queryToken && !done && (
        <section className={styles.section}>
          <h2>Have a link?</h2>
          <p className={styles.hint}>
            Paste the QR link from your primary device if you are setting up this device.
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
        </section>
      )}

      {message && <p className={styles.toast}>{message}</p>}
    </div>
  );
}