import styles from './InstalledClientGate.module.css';
import { isLibsignalRuntimeAvailable, requiresProductionCrypto } from '../lib/cryptoPolicy';

/**
 * Blocks browser-tab chat in production client builds.
 * Step 4: production crypto builds also require libsignal runtime (Electron/Android bridge).
 */
function isInstalledRuntime() {
  if (typeof window !== 'undefined' && window.__SSC_ANDROID_CLIENT) return true;
  if (isLibsignalRuntimeAvailable()) return true;
  if (requiresProductionCrypto()) return false;
  const platform = process.env.REACT_APP_SSC_PLATFORM || 'electron';
  const allowed = new Set(['android', 'ios', 'windows', 'mac', 'electron']);
  return allowed.has(platform);
}

export default function InstalledClientGate({ children }) {
  const landingOnly = process.env.REACT_APP_SSC_LANDING_ONLY === 'true';

  if (
    landingOnly ||
    process.env.NODE_ENV === 'development' ||
    isInstalledRuntime()
  ) {
    return children;
  }

  const needsLibsignal = requiresProductionCrypto();

  return (
    <div className={styles.screen}>
      <h1>SSC</h1>
      {needsLibsignal ? (
        <>
          <p>Secure messaging requires the installed SSC app with libsignal enabled.</p>
          <p className={styles.muted}>
            Open the Windows Electron build or Android app — browser tabs cannot access local
            encryption keys.
          </p>
        </>
      ) : (
        <>
          <p>Super Secure Chat runs in the installed Android or Windows app — not in a browser tab.</p>
          <p className={styles.muted}>Download from https://www.supersecurechat.com</p>
        </>
      )}
    </div>
  );
}