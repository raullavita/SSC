import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './RecoveryPanel.module.css';

export default function RecoveryPanel({ onMessage }) {
  const [configured, setConfigured] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/api/auth/recovery/status')
      .then((data) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function handleSetup(e) {
    e.preventDefault();
    if (passphrase.length < 12) {
      onMessage?.('Recovery passphrase must be at least 12 characters');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/recovery/setup', { recovery_passphrase: passphrase });
      setConfigured(true);
      setPassphrase('');
      onMessage?.('Recovery key configured — store your passphrase safely offline');
    } catch (err) {
      onMessage?.(err.message || 'Recovery setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <p className={styles.hint}>
        Recovery lets you reset your password if you forget it. SSC stores only a hash — never your
        passphrase.
      </p>
      {configured ? (
        <p className={styles.ok}>Recovery key is configured on this account.</p>
      ) : (
        <form onSubmit={handleSetup} className={styles.form}>
          <label className={styles.label}>
            Recovery passphrase
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              minLength={12}
              placeholder="12+ characters"
            />
          </label>
          <button type="submit" disabled={busy}>
            Set up recovery key
          </button>
        </form>
      )}
    </section>
  );
}