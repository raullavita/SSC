import { appVersionLabel } from '../lib/appMode';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.brand} aria-hidden="false">
        <div className={styles.brandInner}>
          <div className={styles.logoMark}>ssc</div>
          <h1 className={styles.productName}>Super Secure Chat</h1>
          <p className={styles.tagline}>Private messaging you can verify.</p>
          <ul className={styles.highlights}>
            <li>
              <span className={styles.dot} />
              End-to-end encryption with Signal Protocol
            </li>
            <li>
              <span className={styles.dot} />
              Keys and decrypted history stay on your device
            </li>
            <li>
              <span className={styles.dot} />
              Safety numbers, sealed sender, panic wipe
            </li>
          </ul>
          <p className={styles.foot}>{appVersionLabel()} · Secured with libsignal</p>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.card}>
          {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
          {subtitle ? <p className={styles.cardSub}>{subtitle}</p> : null}
          {children}
        </div>
      </main>
    </div>
  );
}