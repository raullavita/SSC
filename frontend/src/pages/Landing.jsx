import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import styles from './Landing.module.css';

const LANDING_ONLY = process.env.REACT_APP_SSC_LANDING_ONLY === 'true';

export default function Landing() {
  if (LANDING_ONLY) {
    return <LandingPublic />;
  }
  return <LandingDev />;
}

function LandingPublic() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>SSC</h1>
        <p className={styles.subtitle}>Super Secure Chat</p>
        <p className={styles.tagline}>
          End-to-end encrypted messaging for installed clients only. This website is
          informational — there is no web chat.
        </p>
      </header>

      <section className={styles.card}>
        <h2>Get the app</h2>
        <p className={styles.lead}>
          Sign up, messaging, calls, and encryption run inside the installed Android or
          Windows app — not in a browser tab.
        </p>
        <div className={styles.platforms}>
          <div className={styles.platform}>
            <strong>Windows</strong>
            <span>Desktop installer (Electron)</span>
            <span className={styles.muted}>Build locally with scripts/build_electron.ps1</span>
          </div>
          <div className={styles.platform}>
            <strong>Android</strong>
            <span>Installed APK</span>
            <span className={styles.muted}>Build locally with scripts/build_android.ps1</span>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Security</h2>
        <ul className={styles.featureList}>
          <li>Signal Protocol (PQXDH / Kyber) on installed clients</li>
          <li>Server stores ciphertext only — no inside AI on your messages</li>
          <li>Safety numbers, sealed sender, and encrypted reactions</li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          <a href="https://supersecurechat.com">supersecurechat.com</a> — product site only.
          Use the installed app to connect.
        </p>
      </footer>
    </div>
  );
}

function LandingDev() {
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
        <p className={styles.badge}>Dev</p>
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
          <Link to="/login">Sign in</Link> — local dev chat scaffold only.
        </p>
        <p>Production website has no web chat.</p>
      </footer>
    </div>
  );
}