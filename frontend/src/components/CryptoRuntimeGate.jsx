import { useEffect, useState } from 'react';
import { requiresProductionCrypto } from '../lib/cryptoPolicy';
import styles from './InstalledClientGate.module.css';

const ELECTRON_PLATFORMS = new Set(['electron', 'windows', 'mac']);

function isElectronShell() {
  if (typeof window !== 'undefined' && window.__SSC_ELECTRON_CLIENT) return true;
  const platform = (process.env.REACT_APP_SSC_PLATFORM || '').trim().toLowerCase();
  return ELECTRON_PLATFORMS.has(platform);
}

async function probeLibsignalRuntime() {
  if (typeof window === 'undefined' || !window.sscCrypto) return false;
  try {
    const available = await window.sscCrypto.available;
    return Boolean(available);
  } catch {
    return false;
  }
}

export default function CryptoRuntimeGate({ children }) {
  const [state, setState] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!requiresProductionCrypto() || !isElectronShell()) {
        if (!cancelled) setState('ready');
        return;
      }
      const ok = await probeLibsignalRuntime();
      if (!cancelled) setState(ok ? 'ready' : 'blocked');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <div className={styles.screen}>
        <h1>SSC</h1>
        <p>Starting secure messaging engine…</p>
      </div>
    );
  }

  if (state === 'blocked') {
    const preloadMissing = typeof window !== 'undefined' && !window.sscCrypto;
    return (
      <div className={styles.screen}>
        <h1>Encryption engine blocked</h1>
        {preloadMissing ? (
          <p>
            SSC could not start its secure bridge (preload script failed). Reinstall from the
            latest NSIS installer, or rebuild after the preload fix is applied.
          </p>
        ) : (
          <p>
            Windows Smart App Control blocked SSC&apos;s unsigned encryption module
            (<code>libsignal-client</code>). The app cannot run securely without it.
          </p>
        )}
        <p className={styles.muted}>
          Fix options: turn off Smart App Control in Windows Security → App &amp; browser
          control, or install a properly Authenticode-signed SSC build once signing is enabled
          for releases.
        </p>
        <p className={styles.muted}>
          Check Windows Security → Protection history for the blocked file name.
        </p>
      </div>
    );
  }

  return children;
}