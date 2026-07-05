import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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

  if (!loading && user) return <Navigate to="/chat" replace />;

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

  return (
    <div className={styles.page}>
      <h1>Account recovery</h1>
      {step === 'verify' ? (
        <form onSubmit={handleVerify}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Recovery passphrase
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Verify recovery key
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Reset password & sign in
          </button>
        </form>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}