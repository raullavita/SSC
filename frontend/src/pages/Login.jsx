import { useEffect, useRef, useState } from 'react';
import TurnstileWidget from '../components/TurnstileWidget';
import { getCaptchaConfig } from '../lib/captcha';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import AuthSplash from '../components/AuthSplash';
import { useAuth } from '../context/AuthContext';
import { googleAuthEnabled, promptGoogleSignIn } from '../lib/googleAuth';
import { isInstalledApp } from '../lib/appMode';
import { postAuthPath } from '../lib/onboarding';
import styles from './Login.module.css';

export default function Login() {
  const { user, loading, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next');
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [captchaConfig, setCaptchaConfig] = useState({ required: false, siteKey: null });
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef(null);
  const installed = isInstalledApp();

  useEffect(() => {
    getCaptchaConfig().then(setCaptchaConfig);
  }, []);

  if (loading) return <AuthSplash />;
  if (user) return <Navigate to={postAuthPath(user, nextParam || '/chat')} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let authed;
      if (mode === 'login') {
        authed = await login(email, password);
      } else {
        if (captchaConfig.required && !captchaToken) {
          setError('Complete the security check before registering.');
          return;
        }
        authed = await register(
          email,
          password,
          displayName || email.split('@')[0],
          captchaToken || null
        );
      }
      navigate(postAuthPath(authed, nextParam || '/chat'));
    } catch (err) {
      setError(err.body?.detail || err.message || 'Auth failed');
      turnstileRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      const data = await promptGoogleSignIn();
      if (data) {
        const authed = await loginWithGoogle(data);
        navigate(postAuthPath(authed, nextParam || '/chat'));
      }
    } catch (err) {
      setError(err.body?.detail || err.message || 'Google sign-in failed');
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle =
    mode === 'login'
      ? 'Sign in to continue to your encrypted chats.'
      : 'Register with email — your keys stay on this device.';

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <div className={styles.tabs} role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={mode === 'login' ? styles.tabActive : styles.tab}
          onClick={() => {
            setMode('login');
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={mode === 'register' ? styles.tabActive : styles.tab}
          onClick={() => {
            setMode('register');
            setError(null);
          }}
        >
          Register
        </button>
      </div>

      {googleAuthEnabled() && (
        <button type="button" className={styles.googleBtn} onClick={onGoogle} disabled={busy}>
          Continue with Google
        </button>
      )}

      {googleAuthEnabled() && <p className={styles.orDivider}>or use email</p>}

      <form className={styles.form} onSubmit={onSubmit}>
        {mode === 'register' && (
          <label className={styles.field}>
            <span>Display name</span>
            <input
              placeholder="How contacts see you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {mode === 'register' && captchaConfig.siteKey && (
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={captchaConfig.siteKey}
            onToken={setCaptchaToken}
          />
        )}
        {error && (
          <p className={styles.error} role="alert">
            {String(error)}
          </p>
        )}
        <button type="submit" className={styles.primaryBtn} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className={styles.links}>
        <Link to="/recovery" className={styles.link}>
          Forgot password? Use recovery key
        </Link>
        {!installed && (
          <Link to="/" className={styles.linkMuted}>
            ← Back to website
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}