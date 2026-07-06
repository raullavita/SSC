import { resolveGroupE2EBadge } from '../../lib/groupE2E';
import styles from './GroupE2EBanner.module.css';

export default function GroupE2EBanner({ badge = resolveGroupE2EBadge() }) {
  if (!badge?.visible || badge.variant === 'libsignal') return null;

  return (
    <div className={styles.banner} role="status">
      <strong>Group encryption (dev mode)</strong>
      <p>
        This browser build uses a dev-only group cipher. Install the SSC Android or Windows app for
        real libsignal sender keys.
      </p>
    </div>
  );
}