import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useCall } from '../chat/useCall';
import { useChatMessages } from '../chat/useChatMessages';
import { useFileTransfer } from '../chat/useFileTransfer';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { fetchLanguages, translateText } from '../lib/translation';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';
import styles from './ChatHome.module.css';

export default function ChatHome() {
  const { user, loading, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [draft, setDraft] = useState('');
  const [listError, setListError] = useState(null);
  const [translateTarget, setTranslateTarget] = useState('es');
  const [languages, setLanguages] = useState(['en', 'es', 'fr', 'de']);
  const [translatedPreview, setTranslatedPreview] = useState('');
  const fileInputRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId);

  const { messages, sendMessage, loading: messagesLoading } = useChatMessages(
    activeId,
    Boolean(user),
    active?.peer_id
  );

  const { uploadFile, uploading, error: fileError } = useFileTransfer(activeId);
  const { startCall, status: callStatus, cleanup: endCall } = useCall({
    conversationId: activeId,
    peerId: active?.peer_id,
    userId: user?.id,
    enabled: Boolean(user && active),
  });

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
    if (user) {
      loadConversations();
      registerDeviceAndPrekeys({
        deviceId: '1',
        deviceName: 'SSC Client',
        platform: 'electron',
      }).catch(() => {});
      fetchLanguages()
        .then(setLanguages)
        .catch(() => {});
    }
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

  async function onTranslateDraft() {
    if (!draft.trim()) return;
    try {
      const out = await translateText(draft, { target: translateTarget });
      setTranslatedPreview(out);
    } catch (err) {
      setListError(err.message);
    }
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploaded = await uploadFile(file);
    if (uploaded) {
      setListError(null);
    }
    e.target.value = '';
  }

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
        {fileError && <p className={styles.error}>{String(fileError)}</p>}

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
              <span>
                Chat with <code>{active.peer_id}</code>
              </span>
              <div className={styles.callBar}>
                <button type="button" onClick={() => startCall(false)}>
                  Call
                </button>
                <button type="button" onClick={() => startCall(true)}>
                  Video
                </button>
                {callStatus !== 'idle' && (
                  <button type="button" onClick={endCall}>
                    End ({callStatus})
                  </button>
                )}
              </div>
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
                placeholder="Message (Signal E2EE)"
              />
              <select
                value={translateTarget}
                onChange={(e) => setTranslateTarget(e.target.value)}
                aria-label="Translation target"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <button type="button" onClick={onTranslateDraft}>
                Translate
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={onFileSelected}
              />
              <button type="submit">Send</button>
            </form>
            {translatedPreview && (
              <p className={styles.muted}>
                Translation ({translateTarget}): {translatedPreview}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}