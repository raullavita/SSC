import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import styles from './InviteQr.module.css';

export default function InviteQr({ url, label = 'Scan to add on SSC' }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: '#0b141a', light: '#ffffff' } })
      .then((png) => {
        if (!cancelled) setDataUrl(png);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'QR failed');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!dataUrl) return <p className={styles.loading}>Generating QR…</p>;

  return (
    <div className={styles.wrap}>
      <img className={styles.qr} src={dataUrl} alt={label} />
      <p className={styles.caption}>{label}</p>
    </div>
  );
}