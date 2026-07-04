import styles from './InstalledClientGate.module.css';

const ALLOWED = new Set(['android', 'ios', 'windows', 'mac', 'electron']);

/**
 * Blocks browser-tab chat in production client builds.
 * Dev (`yarn start`) and landing-only site skip this gate.
 */
function isInstalledRuntime(platform) {
  if (typeof window !== 'undefined' && window.__SSC_ANDROID_CLIENT) return true;
  if (typeof window !== 'undefined' && window.sscCrypto) return true;
  return ALLOWED.has(platform);
}

export default function InstalledClientGate({ children }) {
  const platform = process.env.REACT_APP_SSC_PLATFORM || 'electron';
  const landingOnly = process.env.REACT_APP_SSC_LANDING_ONLY === 'true';

  if (
    landingOnly ||
    process.env.NODE_ENV === 'development' ||
    isInstalledRuntime(platform)
  ) {
    return children;
  }

  return (
    <div className={styles.screen}>
      <h1>SSC</h1>
      <p>Super Secure Chat runs in the installed Android or Windows app — not in a browser tab.</p>
      <p className={styles.muted}>Download from https://www.supersecurechat.com</p>
    </div>
  );
}