import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  createBroadcastList,
  deleteBroadcastList,
  listBroadcastLists,
  updateBroadcastList,
} from '../lib/broadcastLists';
import styles from './BroadcastListsPanel.module.css';

export default function BroadcastListsPanel({ onMessage }) {
  const [lists, setLists] = useState([]);
  const [friends, setFriends] = useState([]);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
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

  function startEdit(item) {
    setEditingId(item.id);
    setName(item.name || '');
    setSelectedIds([...(item.recipient_ids || [])]);
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setSelectedIds([]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || selectedIds.length === 0) {
      onMessage?.('Enter a list name and pick at least one contact');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateBroadcastList(editingId, {
          name: name.trim(),
          recipientIds: selectedIds,
        });
        onMessage?.('Broadcast list updated');
      } else {
        await createBroadcastList({ name: name.trim(), recipientIds: selectedIds });
        onMessage?.('Broadcast list created');
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      onMessage?.(err.message || (editingId ? 'Update failed' : 'Create failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(listId) {
    setBusy(true);
    try {
      await deleteBroadcastList(listId);
      if (editingId === listId) cancelEdit();
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

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.rowStack}>
          <span>{editingId ? 'Edit list name' : 'List name'}</span>
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
        <div className={styles.formActions}>
          <button type="submit" className={styles.btn} disabled={busy || friends.length === 0}>
            {editingId ? 'Save changes' : 'Create list'}
          </button>
          {editingId && (
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
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
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={busy}
                  onClick={() => startEdit(item)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={busy}
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
