import { useEffect, useState } from 'react';
import {
  createBroadcastList,
  deleteBroadcastList,
  listBroadcastLists,
} from '../lib/broadcastLists';
import styles from './BroadcastListsPanel.module.css';

function parseRecipientIds(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export default function BroadcastListsPanel({ onMessage }) {
  const [lists, setLists] = useState([]);
  const [name, setName] = useState('');
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const items = await listBroadcastLists();
      setLists(items);
    } catch (err) {
      onMessage?.(err.message || 'Failed to load broadcast lists');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    const recipientIds = parseRecipientIds(recipients);
    if (!name.trim() || recipientIds.length === 0) {
      onMessage?.('Enter a list name and at least one recipient user id');
      return;
    }
    setBusy(true);
    try {
      await createBroadcastList({ name: name.trim(), recipientIds });
      setName('');
      setRecipients('');
      onMessage?.('Broadcast list created');
      await refresh();
    } catch (err) {
      onMessage?.(err.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(listId) {
    setBusy(true);
    try {
      await deleteBroadcastList(listId);
      onMessage?.('Broadcast list deleted');
      await refresh();
    } catch (err) {
      onMessage?.(err.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Broadcast lists</h3>
      <p className={styles.hint}>
        Save named groups of user ids for one-to-many messaging from the composer.
      </p>

      <form className={styles.form} onSubmit={handleCreate}>
        <label className={styles.rowStack}>
          <span>List name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Family"
            disabled={busy}
          />
        </label>
        <label className={styles.rowStack}>
          <span>Recipient user ids</span>
          <input
            className={styles.input}
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="u_abc123 u_def456"
            disabled={busy}
          />
        </label>
        <button type="submit" className={styles.btn} disabled={busy}>
          Create list
        </button>
      </form>

      {loading ? (
        <p className={styles.hint}>Loading lists…</p>
      ) : lists.length === 0 ? (
        <p className={styles.hint}>No broadcast lists yet.</p>
      ) : (
        <ul className={styles.list}>
          {lists.map((item) => (
            <li key={item.id} className={styles.item}>
              <div>
                <strong>{item.name}</strong>
                <span className={styles.meta}>
                  {item.recipient_ids.length} recipient
                  {item.recipient_ids.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={busy}
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}