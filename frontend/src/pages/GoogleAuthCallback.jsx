import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isInstalledApp } from '../lib/appMode';
import { waitForNativeApiBridge } from '../lib/nativeApiReady';
import { postAuthPath } from '../lib/onboarding';
import styles from './Login.module.css';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exchangeWithRetry(completeGoogleOAuth, code) {
  const attempts = isInstalledApp() ? 4 : 1;
  let lastErr = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (isInstalledApp()) {
      await waitForNativeApiBridge(5000);
    }
    try {
      return await completeGoogleOAuth(code);
    } catch (err) {
      lastErr = err;
      const retryable = /ssc_api_error|failed to fetch|ERR_|fetch failed|invalid_oauth_code/i.test(
        String(err?.message || err?.body?.detail || '')
      );
      if (!retryable || attempt === attempts) throw err;
      await sleep(250 * attempt);
    }
  }
  throw lastErr || new Error('google_oauth_failed');
}

export default function GoogleAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeGoogleOAuth, user } = useAuth();
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const oauthError = params.get('error');
    if (oauthError) {
      setError(oauthError);
      return;
    }

    const code = params.get('oauth_code');
    if (!code) {
      setError('missing_oauth_code');
      return;
    }

    exchangeWithRetry(completeGoogleOAuth, code)
      .then((authed) => navigate(postAuthPath(authed), { replace: true }))
      .catch((err) => setError(err.body?.detail || err.message || 'Google sign-in failed'));
  }, [params, completeGoogleOAuth, navigate]);

  if (user) return <Navigate to={postAuthPath(user)} replace />;

  if (error) {
    return (
      <div className={styles.page}>
        <h1>Google sign-in</h1>
        <p className={styles.error}>{String(error)}</p>
        <Link to="/login">← Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <p>Completing Google sign-in…</p>
    </div>
  );
}