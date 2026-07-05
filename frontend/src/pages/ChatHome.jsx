import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import CallModal from '../components/chat/CallModal';
import Composer from '../components/chat/Composer';
import GroupPanel from '../components/chat/GroupPanel';
import MessageBubble from '../components/chat/MessageBubble';
import StoriesBar from '../components/chat/StoriesBar';
import SafetyVerifyModal from '../components/chat/SafetyVerifyModal';
import UserLookup from '../components/chat/UserLookup';
import { useCall } from '../chat/useCall';
import { useGroupCall } from '../calls/useGroupCall';
import { useChatMessages } from '../chat/useChatMessages';
import { useStories } from '../chat/useStories';
import { useConversationMeta } from '../chat/useConversationMeta';
import { useReadReceipts } from '../chat/useReadReceipts';
import { useFileTransfer } from '../chat/useFileTransfer';
import { useTypingIndicator } from '../chat/useTypingIndicator';
import { useVoiceMessage } from '../chat/useVoiceMessage';
import { useAuth } from '../context/AuthContext';
import { usePresenceMap } from '../hooks/usePresenceMap';
import { api } from '../lib/api';
import { getAutoTranslateEnabled, getPreferredLanguage } from '../lib/chatPrefs';
import { fetchLanguages, translateText } from '../lib/translation';
import { startPresenceHeartbeat, stopPresenceHeartbeat } from '../lib/presence';
import { searchMessages } from '../search/messageIndex';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';
import { computeSafetyNumber } from '../signal/safetyNumber';
import { shouldAutoTranslate } from '../smart/languageDetect';
import styles from './ChatHome.module.css';

export default function ChatHome() {
  const location = useLocation();
  const { user, wsToken, loading, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [listError, setListError] = useState(null);
  const [translateTarget, setTranslateTarget] = useState('en');
  const [userLang, setUserLang] = useState(() => getPreferredLanguage());

  const [languages, setLanguages] = useState(['en', 'es', 'fr', 'de']);
  const [translatedPreview, setTranslatedPreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [disappearingSeconds, setDisappearingSeconds] = useState(0);
  const [inlineTranslations, setInlineTranslations] = useState({});
  const [safetyNumber, setSafetyNumber] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [showSafetyVerify, setShowSafetyVerify] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

  useEffect(() => {
    const openId = location.state?.openConversationId;
    if (openId) setActiveId(openId);
  }, [location.state?.openConversationId]);

  const active = conversations.find((c) => c.id === activeId);
  const isGroup = active?.type === 'group';
  const peerIds = useMemo(
    () => conversations.map((c) => c.peer_id).filter(Boolean),
    [conversations]
  );
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

  const storyPeerId = active?.peer_id || peerIds[0] || null;
  const { byUser: storiesByUser, loading: storiesLoading, postStory, removeStory } = useStories(
    user?.id
  );

  const {
    messages,
    reactionsByTarget,
    pollMeta,
    remainingById,
    sendMessage,
    sendPoll,
    votePoll,
    sendReaction,
    loading: messagesLoading,
  } = useChatMessages(activeId, Boolean(user), active?.peer_id, {
    onSocketEvent: handleSocketEvent,
    wsToken,
    isGroup,
    groupId: active?.group_id,
    userId: user?.id,
    memberIds: active?.participants || [],
  });

  const { readByMessage } = useReadReceipts(activeId, messages, {
    wsToken,
    userId: user?.id,
    enabled: Boolean(user && activeId),
  });

  const handleMetaUpdated = useCallback((conv) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
    );
  }, []);
  const { togglePin, toggleMute } = useConversationMeta(handleMetaUpdated);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
  }, [conversations]);

  const { uploadFile, downloadFile, uploading, error: fileError } = useFileTransfer(
    activeId,
    active?.peer_id
  );
  const { recording, startRecording, stopRecording } = useVoiceMessage(
    activeId,
    active?.peer_id
  );

  const {
    activeCall,
    status: callStatus,
    localStream,
    remoteStream,
    callOpen,
    startCall,
    answerCall,
    declineCall,
    endCall,
    errorMessage: callErrorMessage,
  } = useCall({
    conversationId: activeId,
    peerId: active?.peer_id,
    userId: user?.id,
    wsToken,
    enabled: Boolean(user && active && !isGroup),
  });

  const groupParticipantCount = active?.participants?.length || 2;
  const {
    localStream: groupLocalStream,
    remoteStreams: groupRemoteStreams,
    status: groupCallStatus,
    callOpen: groupCallOpen,
    startGroupCall,
    endGroupCall,
    error: groupCallError,
    mode: groupCallMode,
  } = useGroupCall({
    conversationId: activeId,
    participantCount: groupParticipantCount,
    userId: user?.id,
  });

  const searchHits = useMemo(() => {
    if (!activeId || !searchQuery.trim()) return [];
    return searchMessages(activeId, searchQuery);
  }, [activeId, searchQuery, messages]);

  const messageById = useMemo(() => {
    const map = {};
    for (const m of messages) {
      map[m.id] = m;
    }
    return map;
  }, [messages]);

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
      startPresenceHeartbeat();
      registerDeviceAndPrekeys({
        deviceId: '1',
        deviceName: 'SSC Client',
        platform: 'electron',
      }).catch(() => {});
      fetchLanguages()
        .then(setLanguages)
        .catch(() => {});
      setUserLang(getPreferredLanguage());
    }
    return () => stopPresenceHeartbeat();
  }, [user, loadConversations]);

  useEffect(() => {
    if (active?.peer_id) {
      computeSafetyNumber(active.peer_id)
        .then(setSafetyNumber)
        .catch(() => setSafetyNumber(null));
    } else {
      setSafetyNumber(null);
    }
  }, [active?.peer_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    async function autoTranslateMessages() {
      if (!getAutoTranslateEnabled()) return;
      const pending = messages.filter(
        (m) =>
          m.text &&
          m.sender_id !== user?.id &&
          !inlineTranslations[m.id] &&
          shouldAutoTranslate(m.text, userLang)
      );
      for (const m of pending.slice(-5)) {
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
    if (user && messages.length) autoTranslateMessages();
    return () => {
      cancelled = true;
    };
  }, [messages, user, userLang, inlineTranslations]);

  function scrollToMessage(id) {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  }

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (loading) return <div className={styles.page}>Loading…</div>;

  async function startChat(participantId) {
    if (!participantId?.trim()) return;
    try {
      const data = await api.post('/api/conversations', {
        participant_id: participantId.trim(),
      });
      const conv = data.conversation;
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      setActiveId(conv.id);
      setListError(null);
    } catch (err) {
      setListError(err.body?.detail || err.message);
    }
  }

  async function onGroupCreated(conversationId) {
    await loadConversations();
    setActiveId(conversationId);
  }

  async function onSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    onDraftChange('');
    setTranslatedPreview('');
    try {
      await sendMessage(text, {
        disappearingSeconds: disappearingSeconds || undefined,
        replyTo: replyTo?.id,
      });
      setReplyTo(null);
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

  async function onTranslateMessage(message) {
    if (!message?.text) return;
    try {
      const out = await translateText(message.text, { target: userLang });
      setInlineTranslations((prev) => ({ ...prev, [message.id]: out }));
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

  function getReplyPreview(message) {
    if (!message?.reply_to) return null;
    const parent = messageById[message.reply_to];
    if (!parent) return null;
    return parent.text?.slice(0, 80) || parent.attachment?.name || 'Attachment';
  }

  function getThreadTitle() {
    if (isGroup) return `Group ${active.group_id || active.id}`;
    return active.peer_id;
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <header className={styles.sideHeader}>
          <div>
            <strong>{user.display_name || user.id}</strong>
            <p className={styles.uid}>{user.id}</p>
          </div>
          <div className={styles.sideActions}>
            <Link to="/settings" className={styles.settingsLink} title="Settings">
              ⚙
            </Link>
            <button type="button" onClick={logout} className={styles.logout}>
              Log out
            </button>
          </div>
        </header>

        <StoriesBar
          byUser={storiesByUser}
          userId={user?.id}
          peerIds={peerIds}
          loading={storiesLoading}
          onPost={(text) => postStory(text, { peerId: storyPeerId })}
          onDelete={removeStory}
        />

        <UserLookup onStartChat={startChat} />
        <GroupPanel onGroupCreated={onGroupCreated} />

        {listError && <p className={styles.error}>{String(listError)}</p>}
        {fileError && <p className={styles.error}>{String(fileError)}</p>}

        <ul className={styles.convList}>
          {sortedConversations.map((c) => (
            <li key={c.id} className={styles.convItem}>
              <button
                type="button"
                className={c.id === activeId ? styles.active : ''}
                onClick={() => {
                  setActiveId(c.id);
                  setSearchQuery('');
                  setInlineTranslations({});
                  setReplyTo(null);
                }}
              >
                <span className={styles.convRow}>
                  <span>
                    {c.pinned ? '📌 ' : ''}
                    {c.muted ? '🔇 ' : ''}
                    {c.type === 'group' ? `👥 ${c.group_id}` : c.peer_id || c.id}
                  </span>
                  <span className={styles.convMeta}>
                    {c.unread_count > 0 && (
                      <span className={styles.unreadBadge}>{c.unread_count}</span>
                    )}
                    {presenceMap[c.peer_id] && (
                      <span className={styles.presenceDot} title={presenceMap[c.peer_id]}>
                        {presenceMap[c.peer_id] === 'Online' ? '●' : ''}
                      </span>
                    )}
                  </span>
                </span>
              </button>
              <span className={styles.convActions}>
                <button
                  type="button"
                  title={c.pinned ? 'Unpin' : 'Pin'}
                  onClick={() => togglePin(c.id, !c.pinned)}
                >
                  {c.pinned ? '📌' : '📍'}
                </button>
                <button
                  type="button"
                  title={c.muted ? 'Unmute' : 'Mute'}
                  onClick={() => toggleMute(c.id, !c.muted)}
                >
                  {c.muted ? '🔇' : '🔔'}
                </button>
              </span>
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
                  Chat with <code>{getThreadTitle()}</code>
                </span>
                {presenceMap[active.peer_id] && (
                  <span className={styles.presenceLabel}>{presenceMap[active.peer_id]}</span>
                )}
                {peerTyping && <span className={styles.typing}>typing…</span>}
              </div>
              {safetyNumber?.displayable && !isGroup && (
                <p className={styles.safetyNumber}>
                  Safety number: <code>{safetyNumber.displayable}</code>
                  <button
                    type="button"
                    className={styles.verifyBtn}
                    onClick={() => setShowSafetyVerify(true)}
                  >
                    Verify
                  </button>
                </p>
              )}
              {!isGroup ? (
                <div className={styles.callBar}>
                  <button type="button" onClick={() => startCall(false)}>
                    📞 Call
                  </button>
                  <button type="button" onClick={() => startCall(true)}>
                    📹 Video
                  </button>
                </div>
              ) : (
                <div className={styles.callBar}>
                  <button type="button" onClick={() => startGroupCall(false)}>
                    📞 Group call
                  </button>
                  <button type="button" onClick={() => startGroupCall(true)}>
                    📹 Group video
                  </button>
                  {groupCallError && <span className={styles.muted}>{groupCallError}</span>}
                  {groupCallMode === 'sfu' && (
                    <span className={styles.muted}>SFU ({groupParticipantCount} participants)</span>
                  )}
                </div>
              )}
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
                    <li key={hit.id}>
                      <button type="button" onClick={() => scrollToMessage(hit.id)}>
                        {hit.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.messages}>
              {messagesLoading && <p className={styles.muted}>Loading messages…</p>}
              {messages.map((m) => (
                <div
                  key={m.id}
                  ref={(el) => {
                    messageRefs.current[m.id] = el;
                  }}
                >
                  <MessageBubble
                    message={m}
                    isOutgoing={m.sender_id === user.id}
                    userId={user.id}
                    inlineTranslation={inlineTranslations[m.id]}
                    reactions={reactionsByTarget[m.id] || []}
                    replyPreview={getReplyPreview(m)}
                    highlighted={highlightedId === m.id}
                    onReply={setReplyTo}
                    onReaction={sendReaction}
                    onTranslate={onTranslateMessage}
                    downloadFile={downloadFile}
                    readAt={readByMessage[m.id]}
                    poll={m.poll}
                    pollTallies={m.poll_id ? pollMeta[m.poll_id]?.tallies : undefined}
                    pollViewerVote={m.poll_id ? pollMeta[m.poll_id]?.viewerVote : null}
                    onPollVote={
                      m.poll_id
                        ? (index) => votePoll(m.poll_id, index)
                        : undefined
                    }
                    disappearingRemaining={remainingById[m.id]}
                  />
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {replyTo && (
              <div className={styles.replyBar}>
                <span>
                  Replying to:{' '}
                  {replyTo.text?.slice(0, 60) || replyTo.attachment?.name || 'Message'}
                </span>
                <button type="button" onClick={() => setReplyTo(null)}>
                  ✕
                </button>
              </div>
            )}

            {showPollForm && !isGroup && (
              <div className={styles.replyBar}>
                <input
                  placeholder="Poll question"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                />
                {pollOptions.map((opt, idx) => (
                  <input
                    key={`poll-opt-${idx}`}
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
                    if (!pollQuestion.trim() || options.length < 2) return;
                    await sendPoll(pollQuestion, options);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                    setShowPollForm(false);
                  }}
                >
                  Post poll
                </button>
                <button type="button" onClick={() => setShowPollForm(false)}>
                  Cancel
                </button>
              </div>
            )}

            <Composer
              draft={draft}
              onDraftChange={(value) => {
                setDraft(value);
                onDraftChange(value);
              }}
              onSend={onSend}
              onTranslate={onTranslateDraft}
              translatedPreview={translatedPreview}
              onUseTranslation={() => {
                if (translatedPreview) {
                  setDraft(translatedPreview);
                  setTranslatedPreview('');
                }
              }}
              onDismissTranslation={() => setTranslatedPreview('')}
              translateTarget={translateTarget}
              onTranslateTargetChange={setTranslateTarget}
              userLang={userLang}
              onUserLangChange={setUserLang}
              languages={languages}
              disappearingSeconds={disappearingSeconds}
              onDisappearingChange={setDisappearingSeconds}
              recording={recording}
              onVoiceToggle={() => (recording ? stopRecording() : startRecording())}
              uploading={uploading}
              onFileSelected={onFileSelected}
              onCreatePoll={!isGroup && active?.peer_id ? () => setShowPollForm(true) : undefined}
            />
          </>
        )}
      </main>

      <SafetyVerifyModal
        open={showSafetyVerify}
        peerId={active?.peer_id}
        onClose={() => setShowSafetyVerify(false)}
      />

      <CallModal
        open={callOpen || groupCallOpen}
        status={groupCallOpen ? groupCallStatus : callStatus}
        peerLabel={isGroup ? getThreadTitle() : active?.peer_id}
        isVideo={Boolean(activeCall?.video) || groupRemoteStreams.length > 0}
        localStream={groupCallOpen ? groupLocalStream : localStream}
        remoteStream={groupCallOpen ? groupRemoteStreams[0] || null : remoteStream}
        errorMessage={groupCallOpen ? null : callErrorMessage}
        onAnswer={answerCall}
        onDecline={declineCall}
        onEnd={groupCallOpen ? endGroupCall : endCall}
      />
    </div>
  );
}