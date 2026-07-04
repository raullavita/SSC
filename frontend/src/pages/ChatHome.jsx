import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useCall } from '../chat/useCall';
import { useChatMessages } from '../chat/useChatMessages';
import { useFileTransfer } from '../chat/useFileTransfer';
import { useTypingIndicator } from '../chat/useTypingIndicator';
import { useVoiceMessage } from '../chat/useVoiceMessage';
import { useAuth } from '../context/AuthContext';
import { usePresenceMap } from '../hooks/usePresenceMap';
import { api } from '../lib/api';
import { fetchLanguages, translateText } from '../lib/translation';
import { searchMessages } from '../search/messageIndex';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';
import { shouldAutoTranslate } from '../smart/languageDetect';
import { useSmartReplies } from '../smart/useSmartReplies';
import styles from './ChatHome.module.css';

const DISAPPEAR_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1m', value: 60 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

export default function ChatHome() {
  const { user, loading, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [draft, setDraft] = useState('');
  const [listError, setListError] = useState(null);
  const [translateTarget, setTranslateTarget] = useState('en');
  const [userLang, setUserLang] = useState('en');
  const [languages, setLanguages] = useState(['en', 'es', 'fr', 'de']);
  const [translatedPreview, setTranslatedPreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [disappearingSeconds, setDisappearingSeconds] = useState(0);
  const [inlineTranslations, setInlineTranslations] = useState({});
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId);
  const peerIds = useMemo(() => conversations.map((c) => c.peer_id).filter(Boolean), [conversations]);
  const presenceMap = usePresenceMap(peerIds);

  const { peerTyping, onDraftChange, handleSocketPayload } = useTypingIndicator({
    conversationId: activeId,
    userId: user?.id,
  });

  const handleSocketEvent = useCallback(
    (data) => {
      handleSocketPayload(data);
    },
    [handleSocketPayload]
  );

  const { messages, sendMessage, loading: messagesLoading } = useChatMessages(
    activeId,
    Boolean(user),
    active?.peer_id,
    { onSocketEvent: handleSocketEvent }
  );

  const { uploadFile, uploading, error: fileError } = useFileTransfer(activeId);
  const { recording, startRecording, stopRecording } = useVoiceMessage(activeId);
  const { suggestions, loading: smartLoading, refresh: refreshSmart, clear: clearSmart } = useSmartReplies();

  const { startCall, status: callStatus, cleanup: endCall } = useCall({
    conversationId: activeId,
    peerId: active?.peer_id,
    userId: user?.id,
    enabled: Boolean(user && active),
  });

  const searchHits = useMemo(() => {
    if (!activeId || !searchQuery.trim()) return [];
    return searchMessages(activeId, searchQuery);
  }, [activeId, searchQuery, messages]);

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
      api.get('/api/smart/config')
        .then((cfg) => {
          if (cfg?.ollama_url_hint) {
            /* client uses REACT_APP_OLLAMA_URL; hint for settings UI later */
          }
        })
        .catch(() => {});
    }
  }, [user, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (active && messages.length) {
      refreshSmart({ messages, peerName: active.peer_id, userId: user?.id });
    } else {
      clearSmart();
    }
  }, [active, messages, user?.id, refreshSmart, clearSmart]);

  useEffect(() => {
    let cancelled = false;
    async function autoTranslate() {
      const pending = messages.filter(
        (m) => m.sender_id !== user?.id && m.text && !inlineTranslations[m.id] && shouldAutoTranslate(m.text, userLang)
      );
      for (const m of pending.slice(-3)) {
        try {
          const translated = await translateText(m.text, { target: userLang });
          if (!cancelled) {
            setInlineTranslations((prev) => ({ ...prev, [m.id]: translated }));
          }
        } catch {
          /* offline */
        }
      }
    }
    if (user && messages.length) autoTranslate();
    return () => {
      cancelled = true;
    };
  }, [messages, user, userLang, inlineTranslations]);

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
    onDraftChange('');
    try {
      await sendMessage(text, {
        disappearingSeconds: disappearingSeconds || undefined,
      });
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
    if (uploaded) setListError(null);
    e.target.value = '';
  }

  function onDraftInput(value) {
    setDraft(value);
    onDraftChange(value);
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
                onClick={() => {
                  setActiveId(c.id);
                  setSearchQuery('');
                  setInlineTranslations({});
                }}
              >
                <span className={styles.convRow}>
                  <span>{c.peer_id || c.id}</span>
                  {presenceMap[c.peer_id] && (
                    <span className={styles.presenceDot} title={presenceMap[c.peer_id]}>
                      {presenceMap[c.peer_id] === 'Online' ? '●' : ''}
                    </span>
                  )}
                </span>
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
              <div className={styles.threadTitle}>
                <span>
                  Chat with <code>{active.peer_id}</code>
                </span>
                {presenceMap[active.peer_id] && (
                  <span className={styles.presenceLabel}>{presenceMap[active.peer_id]}</span>
                )}
                {peerTyping && <span className={styles.typing}>typing…</span>}
              </div>
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

            <div className={styles.searchBar}>
              <input
                placeholder="Search messages (local, encrypted index)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchHits.length > 0 && (
                <ul className={styles.searchHits}>
                  {searchHits.map((hit) => (
                    <li key={hit.id}>{hit.text}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.messages}>
              {messagesLoading && <p className={styles.muted}>Loading messages…</p>}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.sender_id === user.id ? styles.outgoing : styles.incoming}
                >
                  <span>{m.text}</span>
                  {inlineTranslations[m.id] && (
                    <p className={styles.translation}>{inlineTranslations[m.id]}</p>
                  )}
                  {m.disappearing_seconds && (
                    <span className={styles.timer}>⏱ {m.disappearing_seconds}s</span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {suggestions.length > 0 && (
              <div className={styles.smartBar}>
                {smartLoading && <span className={styles.muted}>Smart replies…</span>}
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.smartChip}
                    onClick={() => onDraftInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form className={styles.composer} onSubmit={onSend}>
              <input
                value={draft}
                onChange={(e) => onDraftInput(e.target.value)}
                placeholder="Message (Signal E2EE)"
              />
              <select
                value={disappearingSeconds}
                onChange={(e) => setDisappearingSeconds(Number(e.target.value))}
                aria-label="Disappearing timer"
                title="Disappearing messages"
              >
                {DISAPPEAR_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={userLang}
                onChange={(e) => setUserLang(e.target.value)}
                aria-label="Your language"
                title="Auto-translate to"
              >
                {languages.map((lang) => (
                  <option key={`ul-${lang}`} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
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
              <button
                type="button"
                onClick={() => (recording ? stopRecording() : startRecording())}
                className={recording ? styles.recording : ''}
              >
                {recording ? 'Stop' : 'Voice'}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? '…' : 'File'}
              </button>
              <input ref={fileInputRef} type="file" hidden onChange={onFileSelected} />
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