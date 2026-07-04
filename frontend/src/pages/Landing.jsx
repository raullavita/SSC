import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import styles from './Landing.module.css';

export default function Landing() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/api/health')
      .then(setHealth)
      .catch((e) => setError(e.message || `HTTP ${e.status}`));
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.badge}>Phase 0</p>
        <h1 className={styles.title}>SSC</h1>
        <p className={styles.subtitle}>Super Secure Chat</p>
        <p className={styles.tagline}>
          End-to-end encrypted messaging for installed clients only.
        </p>
      </header>

      <section className={styles.card}>
        <h2>API status</h2>
        {error && <p className={styles.error}>Backend unreachable: {error}</p>}
        {health && (
          <ul className={styles.statusList}>
            <li>
              <span>Environment</span>
              <strong>{health.env}</strong>
            </li>
            <li>
              <span>MongoDB</span>
              <strong>{health.mongo?.status ?? 'unknown'}</strong>
            </li>
            <li>
              <span>Redis</span>
              <strong>{health.redis?.status ?? 'unknown'}</strong>
            </li>
            <li>
              <span>Version</span>
              <strong>{health.version}</strong>
            </li>
          </ul>
        )}
        {!health && !error && <p className={styles.muted}>Checking backend…</p>}
      </section>

      <footer className={styles.footer}>
        <p>
          <Link to="/login">Sign in</Link> to try the Engine 3 chat scaffold (dev).
        </p>
        <p>Production requires the installed Android or Windows app.</p>
      </footer>
    </div>
  );
}