import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteFeedbackPanel from '../components/SiteFeedbackPanel';
import { api } from '../lib/api';
import styles from './Landing.module.css';

const LANDING_ONLY = process.env.REACT_APP_SSC_LANDING_ONLY === 'true';
const RELEASE_TAG = process.env.REACT_APP_SSC_RELEASE_TAG || 'v0.3.0';
const RELEASE_BASE =
  process.env.REACT_APP_SSC_RELEASE_URL ||
  `https://github.com/raullavita/SSC/releases/download/${RELEASE_TAG}`;
const VERSION = process.env.REACT_APP_SSC_VERSION || '0.3.0';
const BUILD = process.env.REACT_APP_SSC_BUILD || '8';
const GITHUB_REPO = 'https://github.com/raullavita/SSC';
const LIBSIGNAL_REPO = 'https://github.com/signalapp/libsignal';

export default function Landing() {
  if (LANDING_ONLY) {
    return <LandingPublic />;
  }
  return <LandingDev />;
}

function LandingPublic() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <a className={styles.navBrand} href="/">
          <span className={styles.navLogo}>SSC</span>
          <span className={styles.navName}>Super Secure Chat</span>
        </a>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#open-source">Open source</a>
          <a href="#download">Download</a>
          <a href="#feedback">Reviews</a>
          <a href="#contribute">Contribute</a>
          <a className={styles.navCta} href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </nav>

      <header className={styles.hero}>
        <p className={styles.badge}>
          v{VERSION} (build {BUILD}) — install-only messenger
        </p>
        <h1 className={styles.title}>Messaging you can verify.</h1>
        <p className={styles.tagline}>
          Super Secure Chat is end-to-end encrypted messaging for installed Android and Windows
          clients. Your messages never leave your device in plaintext — and this website is
          informational only. There is no web chat.
        </p>
        <div className={styles.heroActions}>
          <a className={styles.primaryBtn} href="#download">
            Get the app
          </a>
          <a className={styles.secondaryBtn} href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
            View source on GitHub
          </a>
        </div>
      </header>

      <section id="features" className={styles.section}>
        <h2 className={styles.sectionTitle}>What you get</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>End-to-end encryption</h3>
            <p>
              Signal Protocol (PQXDH / Kyber) on every installed client. The server stores
              ciphertext only — it cannot read your conversations.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Calls &amp; groups</h3>
            <p>
              1:1 and group voice/video via WebRTC, with TURN for NAT traversal and an SFU for
              larger groups. Encrypted signaling end to end.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Rich messaging</h3>
            <p>
              Reactions, voice notes, file sharing, stories, polls, and disappearing messages —
              all encrypted like ordinary chat.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Privacy by default</h3>
            <p>
              Sealed sender, safety numbers, panic wipe, link previews off by default, and
              metadata minimization across the API.
            </p>
          </article>
          <article className={styles.card}>
            <h3>No inside AI</h3>
            <p>
              SSC does not run AI over your message content on the server. Optional translation
              stays user-controlled on the client.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Installed clients only</h3>
            <p>
              Sign up, messaging, and encryption run inside the Android APK or Windows desktop
              app — not in a browser tab on the public site.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <ol className={styles.steps}>
          <li>
            <strong>Install</strong>
            <span>Download the Windows installer or Android APK from GitHub Releases.</span>
          </li>
          <li>
            <strong>Sign up</strong>
            <span>Create an account with email/password or Google — inside the installed app.</span>
          </li>
          <li>
            <strong>Verify</strong>
            <span>Compare safety numbers with contacts to confirm end-to-end encryption.</span>
          </li>
          <li>
            <strong>Chat</strong>
            <span>
              Messages, calls, and media are encrypted on your device before they reach{' '}
              <a href="https://api.supersecurechat.com">api.supersecurechat.com</a>.
            </span>
          </li>
        </ol>
      </section>

      <section id="security" className={styles.section}>
        <h2 className={styles.sectionTitle}>Security model</h2>
        <div className={styles.split}>
          <div className={styles.card}>
            <h3>What the server sees</h3>
            <ul className={styles.featureList}>
              <li>Encrypted message blobs and delivery metadata</li>
              <li>Account identifiers needed for routing</li>
              <li>No plaintext message content</li>
              <li>No AI analysis of your chats</li>
            </ul>
          </div>
          <div className={styles.card}>
            <h3>What stays on your device</h3>
            <ul className={styles.featureList}>
              <li>Private keys and session state (libsignal stores)</li>
              <li>Decrypted message history in local storage</li>
              <li>Panic wipe clears this device only — others keep their copy</li>
              <li>Production builds require real libsignal — no dev crypto fallbacks</li>
            </ul>
          </div>
        </div>
        <p className={styles.note}>
          Report vulnerabilities privately via{' '}
          <a href={`${GITHUB_REPO}/blob/main/SECURITY.md`}>SECURITY.md</a> — not public issues
          with exploit details.
        </p>
      </section>

      <section id="open-source" className={`${styles.section} ${styles.ossSection}`}>
        <h2 className={styles.sectionTitle}>Open source &amp; compliance</h2>
        <p className={styles.lead}>
          SSC is <strong>open source</strong> under the{' '}
          <a href={`${GITHUB_REPO}/blob/main/LICENSE`}>GNU Affero General Public License v3.0 (AGPL-3.0)</a>.
          We build on maintained OSS — we do not reinvent cryptography.
        </p>
        <div className={styles.ossHighlight}>
          <h3>Signal libsignal (AGPL-3.0)</h3>
          <p>
            SSC uses{' '}
            <a href={LIBSIGNAL_REPO} target="_blank" rel="noopener noreferrer">
              Signal&apos;s libsignal
            </a>{' '}
            for end-to-end encryption on Windows (<code>@signalapp/libsignal-client</code>) and
            Android (<code>libsignal-android</code>). Because libsignal is AGPL-licensed, anyone
            who runs a modified network service must offer corresponding source to users interacting
            with it over a network.
          </p>
          <ul className={styles.featureList}>
            <li>
              <strong>Source code:</strong>{' '}
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                github.com/raullavita/SSC
              </a>
            </li>
            <li>
              <strong>License:</strong>{' '}
              <a href={`${GITHUB_REPO}/blob/main/LICENSE`}>LICENSE (AGPL-3.0)</a>
            </li>
            <li>
              <strong>Third-party notices:</strong>{' '}
              <a href={`${GITHUB_REPO}/blob/main/THIRD_PARTY_NOTICES.md`}>THIRD_PARTY_NOTICES.md</a>
            </li>
            <li>
              <strong>libsignal upstream:</strong>{' '}
              <a href={LIBSIGNAL_REPO} target="_blank" rel="noopener noreferrer">
                github.com/signalapp/libsignal
              </a>
            </li>
          </ul>
        </div>
        <table className={styles.ossTable}>
          <thead>
            <tr>
              <th>Layer</th>
              <th>Open-source project</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>E2E crypto</td>
              <td>
                <a href={LIBSIGNAL_REPO} target="_blank" rel="noopener noreferrer">
                  Signal libsignal
                </a>
              </td>
            </tr>
            <tr>
              <td>Group calls (SFU)</td>
              <td>
                <a href="https://mediasoup.org/" target="_blank" rel="noopener noreferrer">
                  mediasoup
                </a>
              </td>
            </tr>
            <tr>
              <td>API</td>
              <td>
                <a href="https://fastapi.tiangolo.com/" target="_blank" rel="noopener noreferrer">
                  FastAPI
                </a>{' '}
                + MongoDB + Redis
              </td>
            </tr>
            <tr>
              <td>Desktop</td>
              <td>
                <a href="https://www.electronjs.org/" target="_blank" rel="noopener noreferrer">
                  Electron
                </a>
              </td>
            </tr>
            <tr>
              <td>UI</td>
              <td>
                <a href="https://react.dev/" target="_blank" rel="noopener noreferrer">
                  React
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        <p className={styles.lead}>
          Contributions welcome — pick a <strong>help wanted</strong> issue, open one focused PR.
          See <a href={`${GITHUB_REPO}/blob/main/CONTRIBUTING.md`}>CONTRIBUTING.md</a>.
        </p>
      </section>

      <section id="contribute" className={styles.section}>
        <h2 className={styles.sectionTitle}>Contribute</h2>
        <p className={styles.lead}>
          SSC is AGPL-3.0 open source. You do not need permission to fork — but for upstream
          merges, please read the contribution policy first.
        </p>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>Good first issues</h3>
            <p>
              Tests, docs, and client polish. Commenting does <strong>not</strong> reserve an issue
              — open a PR when ready.
            </p>
            <a
              className={styles.secondaryBtn}
              href={`${GITHUB_REPO}/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Browse help wanted
            </a>
          </article>
          <article className={styles.card}>
            <h3>Report bugs</h3>
            <p>
              Use GitHub Issues for reproducible bugs (Windows, Android, or API). Include steps
              and build number — no secrets or message content.
            </p>
            <a
              className={styles.secondaryBtn}
              href={`${GITHUB_REPO}/issues/new/choose`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open an issue
            </a>
          </article>
        </div>
        <a
          className={styles.primaryBtn}
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
        >
          Star &amp; contribute on GitHub
        </a>
      </section>

      <section id="download" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Download v{VERSION} (build {BUILD})
        </h2>
        <p className={styles.lead}>
          Install the app to sign up and chat. Same build {BUILD} binaries on this site and{' '}
          <a href={`${GITHUB_REPO}/releases/tag/${RELEASE_TAG}`}>GitHub {RELEASE_TAG}</a>.
        </p>
        <div className={styles.platforms}>
          <div className={styles.platform}>
            <div className={styles.platformIcon}>🖥</div>
            <strong>Windows</strong>
            <span>Desktop installer (Electron + libsignal)</span>
            <a
              className={styles.downloadBtn}
              href={`${RELEASE_BASE}/SSC-Setup-${VERSION}.exe`}
              download
            >
              Download for Windows
            </a>
            <span className={styles.muted}>Build locally: scripts/build_electron.ps1</span>
          </div>
          <div className={styles.platform}>
            <div className={styles.platformIcon}>📱</div>
            <strong>Android</strong>
            <span>Native Android app (Kotlin + libsignal-android)</span>
            <a
              className={styles.downloadBtn}
              href={`${RELEASE_BASE}/SSC-${VERSION}.apk`}
              download
            >
              Download APK
            </a>
            <span className={styles.muted}>Build locally: scripts/build_android_native.ps1 · Firebase testers</span>
          </div>
        </div>
        <p className={styles.muted}>
          <a href={`${GITHUB_REPO}/releases/tag/${RELEASE_TAG}`}>GitHub release {RELEASE_TAG} (build {BUILD})</a>
          {' · '}
          <a href={`${GITHUB_REPO}/releases`}>All releases</a>
          {' · '}
          API: <a href="https://api.supersecurechat.com/api/health">api.supersecurechat.com</a>
        </p>
      </section>

      <section id="feedback" className={styles.section}>
        <h2 className={styles.sectionTitle}>Reviews &amp; feedback</h2>
        <SiteFeedbackPanel />
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <strong>Super Secure Chat</strong>
            <p>Install-only E2E encrypted messenger.</p>
          </div>
          <div>
            <strong>Links</strong>
            <p>
              <a href={GITHUB_REPO}>GitHub</a>
              <br />
              <a href={`${GITHUB_REPO}/blob/main/LICENSE`}>AGPL-3.0 License</a>
              <br />
              <a href={`${GITHUB_REPO}/blob/main/THIRD_PARTY_NOTICES.md`}>Third-party notices</a>
            </p>
          </div>
          <div>
            <strong>Contact</strong>
            <p>
              <a href="mailto:contact@supersecurechat.com">contact@supersecurechat.com</a>
            </p>
          </div>
        </div>
        <p className={styles.footerCopy}>
          © {new Date().getFullYear()} SSC contributors. Source available under AGPL-3.0.
          Uses Signal libsignal — see THIRD_PARTY_NOTICES.md.
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
        <p>
          Production site:{' '}
          <a href="https://www.supersecurechat.com">www.supersecurechat.com</a> (info only).
        </p>
      </footer>
    </div>
  );
}