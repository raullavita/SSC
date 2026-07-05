import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthSplash from '../components/AuthSplash';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { needsUsernameSetup } from '../lib/onboarding';
import styles from './SetupUsername.module.css';

export default function SetupUsername() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!needsUsernameSetup(user)) return <Navigate to="/chat" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    const value = username.trim().toLowerCase();
    if (!value) {
      setError('Pick a username to continue');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/users/me/username', { username: value });
      await refreshUser();
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.body?.detail || err.message || 'Could not save username');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Choose your username</h1>
        <p className={styles.sub}>
          This is how others find you on SSC — like <strong>@alice</strong>. Letters, numbers, and
          underscores only. You can&apos;t change it later.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.row}>
            <span className={styles.at}>@</span>
            <input
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/^@/, '').toLowerCase())}
              placeholder="yourname"
              autoComplete="username"
              autoFocus
              required
              minLength={3}
              maxLength={32}
              pattern="[a-z][a-z0-9_]{2,31}"
              title="3–32 chars: start with a letter; letters, numbers, underscore"
            />
          </div>
          <p className={styles.hint}>3–32 characters · starts with a letter · permanent</p>
          {error && (
            <p className={styles.error} role="alert">
              {String(error)}
            </p>
          )}
          <button type="submit" className={styles.btn} disabled={busy}>
            {busy ? 'Saving…' : 'Continue to chat'}
          </button>
        </form>
      </div>
    </div>
  );
}