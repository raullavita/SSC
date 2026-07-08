import { useEffect, useMemo, useState } from 'react';
import {
  buildSafetyQrPayload,
  comparePastedSafetyValue,
  splitSafetyNumberGroups,
} from '../../lib/safetyVerify';
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
  peerLabel,
  open,
  onClose,
  trust,
  safetyNumber,
  loading,
  error,
  onMarkVerified,
  onResetTrust,
  onRefresh,
}) {
  const [compareInput, setCompareInput] = useState('');
  const [compareConfirmed, setCompareConfirmed] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    if (!open) {
      setCompareInput('');
      setCompareConfirmed(false);
      setCopyMessage('');
    }
  }, [open, peerId]);

  const displayable = safetyNumber?.displayable || '';
  const compareResult = useMemo(
    () => comparePastedSafetyValue(displayable, compareInput),
    [displayable, compareInput]
  );

  if (!open) return null;

  const groups = splitSafetyNumberGroups(displayable);
  const qrPayload = buildSafetyQrPayload(peerId, displayable);
  const status = trust?.status || 'default';
  const isVerified = status === 'verified';

  const peerMismatch =
    compareResult.peerId && peerId && compareResult.peerId !== peerId;

  const canMarkVerified =
    !isVerified &&
    displayable &&
    (compareConfirmed || (compareResult.match && !peerMismatch));

  async function handleCopy() {
    if (!displayable) return;
    try {
      await navigator.clipboard.writeText(displayable);
      setCopyMessage('Copied to clipboard');
    } catch {
      setCopyMessage(displayable);
    }
  }

  function handleMarkVerified() {
    if (!canMarkVerified) return;
    onMarkVerified?.();
    onClose?.();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label="Verify safety number">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>Safety number</h2>
          <button type="button" onClick={onClose} className={styles.close}>
            ✕
          </button>
        </header>

        <span className={`${styles.statusBadge} ${statusClass(status)}`}>
          {trustBadgeLabel(status)}
        </span>

        <p className={styles.peerLine}>
          Contact: <strong>{peerLabel || peerId}</strong>
        </p>

        <p className={styles.hint}>
          Compare this number with your contact in person, or scan the QR code on their device.
          Only mark verified after the numbers match exactly.
        </p>

        {loading && <p className={styles.loading}>Loading safety number…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {displayable && (
          <>
            <div className={styles.numberGrid} aria-label="Safety number digit groups">
              {groups.map((group) => (
                <span key={group} className={styles.numberGroup}>
                  {group}
                </span>
              ))}
            </div>

            <div className={styles.toolRow}>
              <button type="button" className={styles.toolBtn} onClick={handleCopy}>
                Copy number
              </button>
              {onRefresh && (
                <button type="button" className={styles.toolBtn} onClick={onRefresh}>
                  Refresh
                </button>
              )}
            </div>
            {copyMessage && <p className={styles.copyToast}>{copyMessage}</p>}

            <SafetyQr payload={qrPayload} />

            {!isVerified && (
              <div className={styles.compareSection}>
                <label className={styles.compareLabel} htmlFor="safety-compare-input">
                  Paste their safety number or scan result
                </label>
                <input
                  id="safety-compare-input"
                  className={styles.compareInput}
                  value={compareInput}
                  onChange={(e) => setCompareInput(e.target.value)}
                  placeholder="Paste number or ssc://verify/…"
                  autoComplete="off"
                />
                {compareInput && (
                  <p
                    className={
                      compareResult.match && !peerMismatch
                        ? styles.compareOk
                        : styles.compareBad
                    }
                  >
                    {peerMismatch
                      ? 'QR is for a different contact.'
                      : compareResult.match
                        ? 'Numbers match.'
                        : 'Numbers do not match yet.'}
                  </p>
                )}
                <label className={styles.confirmRow}>
                  <input
                    type="checkbox"
                    checked={compareConfirmed}
                    onChange={(e) => setCompareConfirmed(e.target.checked)}
                  />
                  <span>We compared in person and the numbers match</span>
                </label>
              </div>
            )}

            {status === 'changed' && trust?.previousSafetyNumber && (
              <p className={styles.previous}>
                Previous verified number:{' '}
                <code>{trust.previousSafetyNumber}</code>
              </p>
            )}
          </>
        )}

        <div className={styles.actions}>
          {canMarkVerified && (
            <button type="button" className={styles.primaryBtn} onClick={handleMarkVerified}>
              Mark as verified
            </button>
          )}
          {isVerified && (
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