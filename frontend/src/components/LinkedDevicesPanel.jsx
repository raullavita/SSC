import { useEffect, useState } from 'react';
import DeviceLinkQr from './DeviceLinkQr';
import {
  deviceLinkDeepLink,
  deviceLinkWebUrl,
  formatExpiryCountdown,
  getLocalDeviceId,
  platformLabel,
} from '../lib/deviceLink';
import styles from './LinkedDevicesPanel.module.css';

export default function LinkedDevicesPanel({
  devices = [],
  linkSession,
  linkLabel,
  onLinkLabelChange,
  onCreateLink,
  onRevoke,
  loading,
  error,
  onMessage,
}) {
  const [countdown, setCountdown] = useState('');
  const localDeviceId = getLocalDeviceId();

  useEffect(() => {
    if (!linkSession?.expiresAt) {
      setCountdown('');
      return undefined;
    }
    const tick = () => setCountdown(formatExpiryCountdown(linkSession.expiresAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [linkSession?.expiresAt]);

  async function copyText(text, label) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onMessage?.(`${label} copied`);
    } catch {
      onMessage?.(text);
    }
  }

  const webUrl = linkSession?.token
    ? deviceLinkWebUrl(linkSession.token, window.location.origin)
    : '';
  const deepLink = linkSession?.token ? deviceLinkDeepLink(linkSession.token) : '';
  const expired = countdown === 'Expired';

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>
        Link Android or another desktop. Messages sync in real time across linked devices (max{' '}
        {linkSession?.maxDevices || 5}).
      </p>

      <label className={styles.label}>
        <span>New device label</span>
        <input
          className={styles.input}
          value={linkLabel}
          onChange={(e) => onLinkLabelChange(e.target.value)}
        />
      </label>

      <button type="button" className={styles.primaryBtn} disabled={loading} onClick={onCreateLink}>
        {loading ? 'Generating…' : 'Generate QR link'}
      </button>

      {linkSession?.token && !expired && (
        <div className={styles.linkCard}>
          <p className={styles.expiry}>Expires in {countdown}</p>
          <DeviceLinkQr url={webUrl} />
          <p className={styles.mono}>{webUrl}</p>
          <div className={styles.actions}>
            <button type="button" onClick={() => copyText(webUrl, 'Link')}>
              Copy link
            </button>
            <button type="button" onClick={() => copyText(deepLink, 'Deep link')}>
              Copy app link
            </button>
          </div>
          <p className={styles.hint}>
            On the new device: scan the QR or open the link (sign in on that device if prompted).
            Keys stay on your devices — the server only relays encrypted messages.
          </p>
        </div>
      )}

      {expired && linkSession?.token && (
        <p className={styles.expired}>Link expired. Generate a new QR to link another device.</p>
      )}

      <div className={styles.deviceList}>
        <h3>Your devices ({devices.length})</h3>
        {devices.length === 0 && <p className={styles.hint}>No linked devices yet.</p>}
        {devices.map((d) => {
          const isCurrent = d.id === localDeviceId;
          return (
            <div key={d.id} className={styles.deviceRow}>
              <div>
                <strong>
                  {d.name || 'Device'} ({platformLabel(d.platform)})
                </strong>
                {isCurrent && <span className={styles.badge}>This device</span>}
                <p className={styles.mono}>{d.id}</p>
              </div>
              <button
                type="button"
                className={styles.revokeBtn}
                disabled={loading || isCurrent}
                onClick={() => onRevoke(d.id)}
                title={isCurrent ? 'Cannot revoke the device you are using' : 'Revoke device'}
              >
                Revoke
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}