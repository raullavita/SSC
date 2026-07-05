import { useState } from 'react';
import { api } from '../../lib/api';
import { lookupPathForQuery } from '../../lib/inviteLink';
import styles from './UserLookup.module.css';

export default function UserLookup({ onStartChat, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLookup(e) {
    e?.preventDefault?.();
    const raw = query.trim();
    if (!raw) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.get(lookupPathForQuery(raw));
      setResult(data.user);
    } catch (err) {
      setError(err.body?.detail || err.message || 'User not found');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={handleLookup}>
        <input
          className={styles.input}
          placeholder="@username or user ID (u_…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Lookup username or user ID"
        />
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? '…' : 'Find'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      {result && (
        <div className={styles.result}>
          <div>
            <strong>{result.display_name || result.username || result.id}</strong>
            {result.username && <p className={styles.handle}>@{result.username}</p>}
            <p className={styles.id}>{result.id}</p>
          </div>
          <button type="button" className={styles.chatBtn} onClick={() => onStartChat(result.id)}>
            Chat
          </button>
        </div>
      )}
    </div>
  );
}