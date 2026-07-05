import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './FriendRequestsPanel.module.css';

export default function FriendRequestsPanel({ onAccepted }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [busy, setBusy] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([
        api.get('/api/friend_requests/incoming'),
        api.get('/api/friend_requests/outgoing'),
      ]);
      setIncoming(inc.requests || []);
      setOutgoing(out.requests || []);
    } catch {
      setIncoming([]);
      setOutgoing([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function accept(requestId) {
    setBusy(requestId);
    try {
      const data = await api.post(`/api/friend_requests/${requestId}/accept`, {});
      await reload();
      onAccepted?.(data.conversation_id);
    } finally {
      setBusy(null);
    }
  }

  async function decline(requestId) {
    setBusy(requestId);
    try {
      await api.post(`/api/friend_requests/${requestId}/decline`, {});
      await reload();
    } finally {
      setBusy(null);
    }
  }

  if (!incoming.length && !outgoing.length) return null;

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>Friend requests</h3>
      {incoming.map((req) => (
        <div key={req.id} className={styles.row}>
          <span className={styles.label}>From {req.from_user_id}</span>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy === req.id}
              onClick={() => accept(req.id)}
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy === req.id}
              onClick={() => decline(req.id)}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((req) => (
        <div key={req.id} className={styles.row}>
          <span className={styles.label}>Pending → {req.to_user_id}</span>
        </div>
      ))}
    </section>
  );
}