import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  createBroadcastList,
  deleteBroadcastList,
  listBroadcastLists,
} from '../lib/broadcastLists';
import styles from './BroadcastListsPanel.module.css';

export default function BroadcastListsPanel({ onMessage }) {
  const [lists, setLists] = useState([]);
  const [friends, setFriends] = useState([]);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const friendMap = useMemo(() => {
    const map = {};
    for (const f of friends) map[f.id] = f;
    return map;
  }, [friends]);

  async function refresh() {
    setLoading(true);
    try {
      const [items, convData] = await Promise.all([
        listBroadcastLists(),
        api.get('/api/conversations'),
      ]);
      setLists(items);
      const direct = (convData.conversations || []).filter((c) => c.type !== 'group');
      const seen = new Set();
      const contacts = [];
      for (const c of direct) {
        const peerId = c.peer_id || c.participants?.find((p) => p !== c.owner_id);
        if (!peerId || seen.has(peerId)) continue;
        seen.add(peerId);
        contacts.push({
          id: peerId,
          label: c.peer_display_name || c.peer_username || peerId.slice(0, 10),
        });
      }
      setFriends(contacts);
    } catch (err) {
      onMessage?.(err.message || 'Failed to load broadcast lists');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleRecipient(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim() || selectedIds.length === 0) {
      onMessage?.('Enter a list name and pick at least one contact');
      return;
    }
    setBusy(true);
    try {
      await createBroadcastList({ name: name.trim(), recipientIds: selectedIds });
      setName('');
      setSelectedIds([]);
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
        Message several contacts at once from the composer 📣 menu in any chat.
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
        <div className={styles.rowStack}>
          <span>Contacts</span>
          {friends.length === 0 ? (
            <p className={styles.hint}>Start a 1:1 chat first to add contacts here.</p>
          ) : (
            <ul className={styles.friendPick}>
              {friends.map((friend) => (
                <li key={friend.id}>
                  <label className={styles.friendLabel}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(friend.id)}
                      onChange={() => toggleRecipient(friend.id)}
                      disabled={busy}
                    />
                    <span>{friend.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className={styles.btn} disabled={busy || friends.length === 0}>
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
                  {item.recipient_ids
                    .map((id) => friendMap[id]?.label || id.slice(0, 8))
                    .join(', ')}
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