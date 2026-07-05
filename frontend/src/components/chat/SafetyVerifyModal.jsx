import { trustBadgeLabel } from '../../lib/trustStore';
import SafetyQr from './SafetyQr';
import styles from './SafetyVerifyModal.module.css';

function statusClass(status) {
  if (status === 'verified') return styles.statusVerified;
  if (status === 'changed') return styles.statusChanged;
  return styles.statusDefault;
}

export default function SafetyVerifyModal({
  peerId,
  open,
  onClose,
  trust,
  safetyNumber,
  loading,
  error,
  onMarkVerified,
  onResetTrust,
}) {
  if (!open) return null;

  const qrPayload =
    peerId && safetyNumber?.displayable
      ? `ssc://verify/${peerId}/${safetyNumber.displayable.replace(/\s+/g, '')}`
      : null;

  const status = trust?.status || 'default';
  const canMarkVerified = status !== 'verified' && safetyNumber?.displayable;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Verify safety number">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>Verify contact</h2>
          <button type="button" onClick={onClose} className={styles.close}>
            ✕
          </button>
        </header>

        <span className={`${styles.statusBadge} ${statusClass(status)}`}>
          {trustBadgeLabel(status)}
        </span>

        <p className={styles.hint}>
          Compare this number in person with your contact. If they match, mark the contact as
          verified.
        </p>

        {loading && <p className={styles.loading}>Loading safety number…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {safetyNumber?.displayable && (
          <>
            <p className={styles.number}>{safetyNumber.displayable}</p>
            <SafetyQr payload={qrPayload} />
            <p className={styles.peer}>
              Contact: <code>{peerId}</code>
            </p>
            {status === 'changed' && trust?.previousSafetyNumber && (
              <p className={styles.previous}>
                Previous: <code>{trust.previousSafetyNumber}</code>
              </p>
            )}
          </>
        )}

        <div className={styles.actions}>
          {canMarkVerified && (
            <button type="button" className={styles.primaryBtn} onClick={onMarkVerified}>
              Mark as verified
            </button>
          )}
          {status === 'verified' && (
            <button type="button" className={styles.secondaryBtn} onClick={onResetTrust}>
              Reset verification
            </button>
          )}
          <button type="button" className={styles.okBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}