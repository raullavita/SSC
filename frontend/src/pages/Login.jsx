import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { googleAuthEnabled, promptGoogleSignIn } from '../lib/googleAuth';
import styles from './Login.module.css';

export default function Login() {
  const { user, loading, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/chat';
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={nextPath} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName || email.split('@')[0]);
      }
      navigate(nextPath);
    } catch (err) {
      setError(err.body?.detail || err.message || 'Auth failed');
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
        await loginWithGoogle(data);
        navigate(nextPath);
      }
    } catch (err) {
      setError(err.body?.detail || err.message || 'Google sign-in failed');
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1>SSC</h1>
      <p className={styles.sub}>Sign in to Super Secure Chat</p>

      {googleAuthEnabled() && (
        <button type="button" className={styles.googleBtn} onClick={onGoogle} disabled={busy}>
          Continue with Google
        </button>
      )}

      <form className={styles.form} onSubmit={onSubmit}>
        {mode === 'register' && (
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p className={styles.error}>{String(error)}</p>}
        <button type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button
        type="button"
        className={styles.switch}
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
      </button>
      <Link to="/" className={styles.back}>
        ← Back
      </Link>
    </div>
  );
}