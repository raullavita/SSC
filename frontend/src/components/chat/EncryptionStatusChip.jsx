import { isLibsignalRuntimeAvailable } from '../../lib/cryptoPolicy';
import styles from './EncryptionStatusChip.module.css';

/**
 * Thread-header encryption status (P4.3).
 */
export default function EncryptionStatusChip({ error = null, compact = false }) {
  const libsignal = isLibsignalRuntimeAvailable();
  let variant = 'ok';
  let label = 'E2E';
  let title = 'End-to-end encrypted with Signal Protocol';

  if (error) {
    variant = 'error';
    label = compact ? '!' : 'Setup needed';
    title = String(error);
  } else if (!libsignal) {
    variant = 'warn';
    label = compact ? 'Dev' : 'Dev mode';
    title = 'Development encryption — install production build for full E2E';
  }

  return (
    <span
      className={`${styles.chip} ${styles[variant]}`}
      title={title}
      aria-label={title}
    >
      {variant === 'ok' ? '🔒' : variant === 'error' ? '⚠' : '○'} {label}
    </span>
  );
}