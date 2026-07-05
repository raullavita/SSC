import styles from './AuthSplash.module.css';
import { appVersionLabel } from '../lib/appMode';

export default function AuthSplash() {
  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <div className={styles.logo}>ssc</div>
      <h1 className={styles.title}>Super Secure Chat</h1>
      <p className={styles.sub}>Securing your session…</p>
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.meta}>{appVersionLabel()}</p>
    </div>
  );
}