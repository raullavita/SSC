import { trustBadgeLabel } from '../../lib/trustStore';
import styles from './SafetyVerifyButton.module.css';

function statusClass(status) {
  if (status === 'verified') return styles.verified;
  if (status === 'changed') return styles.changed;
  return styles.default;
}

export default function SafetyVerifyButton({ trust, onClick, disabled = false }) {
  const status = trust?.status || 'default';
  const label =
    status === 'verified'
      ? 'Safety verified'
      : status === 'changed'
        ? 'Verify keys'
        : 'Verify safety';

  return (
    <button
      type="button"
      className={`${styles.btn} ${statusClass(status)}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label}. ${trustBadgeLabel(status)}`}
      title={trustBadgeLabel(status)}
    >
      <span className={styles.icon} aria-hidden="true">
        {status === 'verified' ? '🔒' : status === 'changed' ? '⚠' : '🔐'}
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.badge}>{trustBadgeLabel(status)}</span>
    </button>
  );
}