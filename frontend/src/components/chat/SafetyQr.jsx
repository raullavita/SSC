import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import styles from './SafetyVerifyModal.module.css';

export default function SafetyQr({ payload, label = 'Safety number QR' }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!payload) {
      setDataUrl(null);
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(payload, {
      margin: 1,
      width: 200,
      color: { dark: '#0b141a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'QR failed');
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!dataUrl) return <p className={styles.loading}>Generating QR…</p>;
  return <img className={styles.qr} src={dataUrl} alt={label} />;
}