import { useCallback, useEffect, useState } from 'react';
import { blockUser, listBlockedUsers, unblockUser } from '../lib/abuseReport';
import styles from './BlockedUsersPanel.module.css';

export default function BlockedUsersPanel() {
  const [blocks, setBlocks] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBlockedUsers();
      setBlocks(data.blocks || []);
    } catch (err) {
      setMessage(err.message || 'Failed to load blocks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleBlock(e) {
    e.preventDefault();
    if (!targetId.trim()) return;
    setMessage(null);
    try {
      await blockUser(targetId.trim());
      setTargetId('');
      await refresh();
      setMessage('User blocked');
    } catch (err) {
      setMessage(err.message || 'Block failed');
    }
  }

  async function handleUnblock(blockedUserId) {
    setMessage(null);
    try {
      await unblockUser(blockedUserId);
      await refresh();
      setMessage('User unblocked');
    } catch (err) {
      setMessage(err.message || 'Unblock failed');
    }
  }

  return (
    <section className={styles.wrap}>
      <h3 className={styles.title}>Blocked users</h3>
      <form className={styles.form} onSubmit={handleBlock}>
        <input
          className={styles.input}
          placeholder="User ID to block"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        />
        <button type="submit" className={styles.btn} disabled={loading}>
          Block
        </button>
      </form>
      {message && <p className={styles.hint}>{message}</p>}
      {loading && blocks.length === 0 ? (
        <p className={styles.hint}>Loading…</p>
      ) : (
        <ul className={styles.list}>
          {blocks.map((b) => (
            <li key={b.blocked_user_id}>
              <span>{b.blocked_user_id}</span>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => handleUnblock(b.blocked_user_id)}
              >
                Unblock
              </button>
            </li>
          ))}
          {!blocks.length && !loading && <li className={styles.hint}>No blocked users</li>}
        </ul>
      )}
    </section>
  );
}