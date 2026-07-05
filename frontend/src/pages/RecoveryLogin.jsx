import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import AuthSplash from '../components/AuthSplash';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import styles from './Login.module.css';

export default function RecoveryLogin() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [step, setStep] = useState('verify');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <AuthSplash />;
  if (user) return <Navigate to="/chat" replace />;

  async function handleVerify(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.post('/api/auth/recovery/verify', {
        email,
        recovery_passphrase: passphrase,
      });
      setRecoveryToken(data.recovery_token);
      setStep('reset');
    } catch (err) {
      setError(err.body?.detail || err.message || 'Recovery verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/recovery/reset-password', {
        recovery_token: recoveryToken,
        new_password: newPassword,
      });
      await refreshUser();
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.body?.detail || err.message || 'Password reset failed');
    } finally {
      setBusy(false);
    }
  }

  const title = step === 'verify' ? 'Recover your account' : 'Set a new password';
  const subtitle =
    step === 'verify'
      ? 'Enter the email and recovery passphrase you saved when you registered.'
      : 'Choose a strong new password — your encryption keys stay on this device.';

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      {step === 'verify' ? (
        <form className={styles.form} onSubmit={handleVerify}>
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
            <span>Recovery passphrase</span>
            <input
              type="password"
              placeholder="Your saved recovery key"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {String(error)}
            </p>
          )}
          <button type="submit" className={styles.primaryBtn} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify recovery key'}
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleReset}>
          <label className={styles.field}>
            <span>New password</span>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {String(error)}
            </p>
          )}
          <button type="submit" className={styles.primaryBtn} disabled={busy}>
            {busy ? 'Resetting…' : 'Reset password & sign in'}
          </button>
        </form>
      )}

      <div className={styles.links}>
        <Link to="/login" className={styles.link}>
          ← Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}