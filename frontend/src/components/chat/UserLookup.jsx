import { useState } from 'react';
import { api } from '../../lib/api';
import styles from './UserLookup.module.css';

export default function UserLookup({ onStartChat }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLookup(e) {
    e.preventDefault();
    const id = query.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.get(`/api/users/lookup/${encodeURIComponent(id)}`);
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
          placeholder="User ID (u_…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Lookup user ID"
        />
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? '…' : 'Find'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      {result && (
        <div className={styles.result}>
          <div>
            <strong>{result.display_name || result.id}</strong>
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