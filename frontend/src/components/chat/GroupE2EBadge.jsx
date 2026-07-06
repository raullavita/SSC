import { resolveGroupE2EBadge } from '../../lib/groupE2E';
import styles from './GroupE2EBadge.module.css';

export default function GroupE2EBadge({ compact = false, badge = resolveGroupE2EBadge() }) {
  if (!badge?.visible) return null;

  const text = compact ? badge.label : badge.longLabel;
  const variantClass =
    badge.variant === 'libsignal' ? styles.libsignal : styles.dev;

  return (
    <span
      className={`${styles.badge} ${variantClass} ${compact ? styles.compact : ''}`}
      title={badge.title}
      aria-label={badge.longLabel}
    >
      {badge.variant === 'libsignal' && (
        <span className={styles.icon} aria-hidden="true">
          🔒
        </span>
      )}
      <span>{text}</span>
    </span>
  );
}