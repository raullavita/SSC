import { useEffect, useState } from 'react';
import { requiresProductionCrypto } from '../lib/cryptoPolicy';
import styles from './InstalledClientGate.module.css';

const INSTALLED_PLATFORMS = new Set(['electron', 'windows', 'mac', 'android', 'ios']);

function isInstalledCryptoShell() {
  if (typeof window === 'undefined') return false;
  if (window.__SSC_ELECTRON_CLIENT || window.__SSC_ANDROID_CLIENT || window.__SSC_IOS_CLIENT) {
    return true;
  }
  const platform = (process.env.REACT_APP_SSC_PLATFORM || '').trim().toLowerCase();
  return INSTALLED_PLATFORMS.has(platform);
}

async function probeLibsignalRuntime() {
  if (typeof window === 'undefined' || !window.sscCrypto) {
    return { ok: false, preload: false, diagnostics: null };
  }
  try {
    const [available, diagnostics] = await Promise.all([
      window.sscCrypto.available,
      window.sscCrypto.diagnostics?.() ?? null,
    ]);
    return { ok: Boolean(available), preload: true, diagnostics };
  } catch {
    return { ok: false, preload: true, diagnostics: null };
  }
}

export default function CryptoRuntimeGate({ children }) {
  const [state, setState] = useState('checking');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!requiresProductionCrypto() || !isInstalledCryptoShell()) {
        if (!cancelled) setState('ready');
        return;
      }
      const result = await probeLibsignalRuntime();
      if (!cancelled) {
        setDetail(result);
        setState(result.ok ? 'ready' : 'blocked');
      }
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
    const preloadMissing = !detail?.preload;
    const diag = detail?.diagnostics;
    return (
      <div className={styles.screen}>
        <h1>Encryption engine blocked</h1>
        {preloadMissing ? (
          <p>
            SSC secure bridge did not load. Reinstall the latest SSC app from the website download
            page.
          </p>
        ) : typeof window !== 'undefined' && window.__SSC_ANDROID_CLIENT ? (
          <p>
            Android libsignal bridge failed to load. Rebuild and reinstall the SSC APK — encrypted
            chat cannot run without the native crypto module.
          </p>
        ) : (
          <p>
            Windows Smart App Control blocked SSC&apos;s unsigned encryption module
            (<code>libsignal-client</code>). The app cannot run securely without it.
          </p>
        )}
        <p className={styles.muted}>
          Diagnostics: preload={detail?.preload ? 'ok' : 'missing'}; libsignal=
          {diag?.libsignalAvailable ? 'ok' : 'blocked'}
          {diag?.libsignalLoadError ? ` (${diag.libsignalLoadError})` : ''}
        </p>
        <p className={styles.muted}>
          Installed copy must be updated — old builds are in AppData\Local\Programs\Super Secure
          Chat. Run the latest NSIS installer, or turn off Smart App Control under Windows
          Security → App &amp; browser control.
        </p>
        <p className={styles.muted}>
          Startup log: %APPDATA%\ssc-electron\ssc-startup.log
        </p>
      </div>
    );
  }

  return children;
}