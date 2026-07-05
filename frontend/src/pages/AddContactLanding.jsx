import { Link, useParams } from 'react-router-dom';
import { normalizeUsername, inviteWebUrl } from '../lib/inviteLink';
import styles from './AddContactLanding.module.css';

const RELEASE_BASE =
  process.env.REACT_APP_SSC_RELEASE_URL ||
  'https://github.com/raullavita/SSC/releases/latest/download';
const VERSION = process.env.REACT_APP_SSC_VERSION || '0.2.0';

export default function AddContactLanding() {
  const { username } = useParams();
  const name = normalizeUsername(username);

  return (
    <div className={styles.page}>
      <p className={styles.badge}>SSC invite</p>
      <h1>Add @{name || 'user'} on Super Secure Chat</h1>
      <p className={styles.lead}>
        SSC is install-only E2E encrypted messaging. Open this link in the installed Android or
        Windows app to start a chat — there is no web chat on this site.
      </p>
      {name && (
        <p className={styles.deep}>
          App link: <code>ssc://add/{name}</code>
        </p>
      )}
      <div className={styles.actions}>
        <a className={styles.primary} href={`${RELEASE_BASE}/SSC-Setup-${VERSION}.exe`}>
          Download for Windows
        </a>
        <a className={styles.primary} href={`${RELEASE_BASE}/SSC-${VERSION}.apk`}>
          Download Android APK
        </a>
      </div>
      <p className={styles.muted}>
        <a href="https://github.com/raullavita/SSC/releases">All releases</a>
        {' · '}
        <Link to="/">Back to home</Link>
      </p>
      {name && (
        <p className={styles.muted}>
          After install, open: {inviteWebUrl(name, window.location.origin)}
        </p>
      )}
    </div>
  );
}