import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../lib/onboarding';
import styles from './Login.module.css';

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

    completeGoogleOAuth(code)
      .then((authed) => navigate(postAuthPath(authed), { replace: true }))
      .catch((err) => setError(err.body?.detail || err.message || 'Google sign-in failed'));
  }, [params, completeGoogleOAuth, navigate]);

  if (user) return <Navigate to={postAuthPath(user)} replace />;

  if (error) {
    return (
      <div className={styles.page}>
        <h1>Google sign-in</h1>
        <p className={styles.error}>{String(error)}</p>
        <a href="/login">← Back to sign in</a>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <p>Completing Google sign-in…</p>
    </div>
  );
}