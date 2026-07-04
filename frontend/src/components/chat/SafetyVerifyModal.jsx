import { useEffect, useRef, useState } from 'react';
import { computeSafetyNumber } from '../../signal/safetyNumber';
import styles from './SafetyVerifyModal.module.css';

function drawQr(canvas, text) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 180;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#111';
  ctx.font = '8px monospace';
  const lines = text.match(/.{1,20}/g) || [text];
  lines.slice(0, 12).forEach((line, i) => {
    ctx.fillText(line, 8, 14 + i * 12);
  });
  ctx.strokeStyle = '#00a884';
  ctx.strokeRect(4, 4, size - 8, size - 8);
}

export default function SafetyVerifyModal({ peerId, open, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open || !peerId) return;
    setError(null);
    computeSafetyNumber(peerId)
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load safety number'));
  }, [open, peerId]);

  useEffect(() => {
    if (!data?.displayable || !canvasRef.current) return;
    drawQr(canvasRef.current, `SSC:${peerId}:${data.displayable}`);
  }, [data, peerId]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Verify safety number">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>Verify contact</h2>
          <button type="button" onClick={onClose} className={styles.close}>
            ✕
          </button>
        </header>
        <p className={styles.hint}>
          Compare this number in person with your contact. If they match, your chat is
          verified.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        {data && (
          <>
            <p className={styles.number}>{data.displayable}</p>
            <canvas ref={canvasRef} className={styles.qr} aria-label="Safety number QR" />
            <p className={styles.peer}>
              Contact: <code>{peerId}</code>
            </p>
          </>
        )}
        <button type="button" className={styles.okBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}