import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useChatMessages } from '../chat/useChatMessages';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import styles from './ChatHome.module.css';

export default function ChatHome() {
  const { user, loading, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [draft, setDraft] = useState('');
  const [listError, setListError] = useState(null);

  const { messages, sendMessage, loading: messagesLoading } = useChatMessages(
    activeId,
    Boolean(user)
  );

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get('/api/conversations');
      setConversations(data.conversations || []);
      setListError(null);
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (loading) return <div className={styles.page}>Loading…</div>;

  async function startChat(e) {
    e.preventDefault();
    if (!peerId.trim()) return;
    try {
      const data = await api.post('/api/conversations', { participant_id: peerId.trim() });
      const conv = data.conversation;
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      setActiveId(conv.id);
      setPeerId('');
    } catch (err) {
      setListError(err.body?.detail || err.message);
    }
  }

  async function onSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    try {
      await sendMessage(text);
    } catch (err) {
      setDraft(text);
      setListError(err.message);
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <header className={styles.sideHeader}>
          <div>
            <strong>{user.display_name || user.email}</strong>
            <p className={styles.uid}>{user.id}</p>
          </div>
          <button type="button" onClick={logout} className={styles.logout}>
            Log out
          </button>
        </header>

        <form className={styles.newChat} onSubmit={startChat}>
          <input
            placeholder="Peer user id (u_…)"
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
          />
          <button type="submit">New chat</button>
        </form>

        {listError && <p className={styles.error}>{String(listError)}</p>}

        <ul className={styles.convList}>
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={c.id === activeId ? styles.active : ''}
                onClick={() => setActiveId(c.id)}
              >
                {c.peer_id || c.id}
              </button>
            </li>
          ))}
        </ul>
        <Link to="/" className={styles.homeLink}>
          ← Home
        </Link>
      </aside>

      <main className={styles.thread}>
        {!active ? (
          <p className={styles.empty}>Select a chat or start a new one.</p>
        ) : (
          <>
            <header className={styles.threadHeader}>
              Chat with <code>{active.peer_id}</code>
            </header>
            <div className={styles.messages}>
              {messagesLoading && <p className={styles.muted}>Loading messages…</p>}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.sender_id === user.id ? styles.outgoing : styles.incoming}
                >
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <form className={styles.composer} onSubmit={onSend}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message (placeholder encryption)"
              />
              <button type="submit">Send</button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}