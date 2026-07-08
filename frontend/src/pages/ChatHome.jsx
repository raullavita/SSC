import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthSplash from '../components/AuthSplash';
import CallModal from '../components/chat/CallModal';
import Composer from '../components/chat/Composer';
import GroupPanel from '../components/chat/GroupPanel';
import MessageBubble from '../components/chat/MessageBubble';
import StoriesBar from '../components/chat/StoriesBar';
import GroupE2EBadge from '../components/chat/GroupE2EBadge';
import GroupE2EBanner from '../components/chat/GroupE2EBanner';
import SafetyVerifyButton from '../components/chat/SafetyVerifyButton';
import SafetyVerifyModal from '../components/chat/SafetyVerifyModal';
import TrustBanner from '../components/chat/TrustBanner';
import ChatPrivacyPanel from '../components/chat/ChatPrivacyPanel';
import UserLookup from '../components/chat/UserLookup';
import { useCall } from '../chat/useCall';
import { useGroupCall } from '../calls/useGroupCall';
import { useChatMessages } from '../chat/useChatMessages';
import { useReactions } from '../chat/useReactions';
import FriendRequestsPanel from '../components/FriendRequestsPanel';
import { useTrustState } from '../chat/useTrustState';
import { useConversationPrivacy } from '../chat/useConversationPrivacy';
import { effectivePrivacy } from '../lib/conversationPrivacy';
import { useStories } from '../chat/useStories';
import { useActiveConversation } from '../chat/useActiveConversation';
import { useConversationMeta } from '../chat/useConversationMeta';
import { useUserConversationSync } from '../chat/useUserConversationSync';
import { useReadReceipts } from '../chat/useReadReceipts';
import { useParticipantNames } from '../chat/useParticipantNames';
import { useFileTransfer } from '../chat/useFileTransfer';
import { useTypingIndicator } from '../chat/useTypingIndicator';
import { useVoiceMessage } from '../chat/useVoiceMessage';
import { useAuth } from '../context/AuthContext';
import { usePresenceMap } from '../hooks/usePresenceMap';
import { api } from '../lib/api';
import { listBroadcastLists } from '../lib/broadcastLists';
import { sendBroadcastMessage } from '../lib/broadcastSend';
import {
  getAutoTranslateEnabled,
  getPreferredLanguage,
  setPreferredLanguage,
} from '../lib/chatPrefs';
import { fetchLanguages, translateText, TranslationError } from '../lib/translation';
import { startPresenceHeartbeat, stopPresenceHeartbeat } from '../lib/presence';
import { searchMessages } from '../search/messageIndex';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';
import { getPeerTrust } from '../lib/trustStore';
import { isInstalledApp } from '../lib/appMode';
import { needsUsernameSetup } from '../lib/onboarding';
import {
  bumpUnread,
  mergeConversationMeta,
  patchConversationInList,
} from '../lib/conversationMeta';
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
  const [convFilter, setConvFilter] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [disappearingSeconds, setDisappearingSeconds] = useState(0);
  const [inlineTranslations, setInlineTranslations] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showSafetyVerify, setShowSafetyVerify] = useState(false);
  const [showPrivacyPanel, setShowPrivacyPanel] = useState(false);
  const [globalPrivacy, setGlobalPrivacy] = useState({
    read_receipts: false,
    last_seen_visible: false,
    typing_visible: true,
  });
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [broadcastLists, setBroadcastLists] = useState([]);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

  useEffect(() => {
    const openId = location.state?.openConversationId;
    if (openId) setActiveId(openId);
  }, [location.state?.openConversationId]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get('/api/conversations');
      setConversations(data.conversations || []);
      setListError(null);
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  const handleMetaUpdated = useCallback((conv) => {
    setConversations((prev) => patchConversationInList(prev, conv));
  }, []);

  const {
    active,
    refresh: refreshActiveConversation,
    applyListPatch,
  } = useActiveConversation(conversations, activeId, handleMetaUpdated);
  const isGroup = active?.type === 'group';

  const handleUserSync = useCallback(
    (payload) => {
      if (payload?.type !== 'sync_message' || !payload.conversation_id) return;
      const convId = payload.conversation_id;
      const updatedAt = payload.message?.created_at;

      setConversations((prev) => {
        const existing = prev.find((entry) => entry.id === convId);
        if (!existing) {
          loadConversations();
          return prev;
        }
        if (convId === activeId) {
          return prev.map((entry) =>
            entry.id === convId
              ? mergeConversationMeta(entry, {
                  unread_count: 0,
                  ...(updatedAt ? { updated_at: updatedAt } : {}),
                })
              : entry
          );
        }
        return prev.map((entry) =>
          entry.id === convId ? bumpUnread(entry, { updatedAt }) : entry
        );
      });

      if (convId === activeId) {
        refreshActiveConversation();
      }
    },
    [activeId, loadConversations, refreshActiveConversation]
  );

  useUserConversationSync({
    userId: user?.id,
    wsToken,
    enabled: Boolean(user),
    onEvent: handleUserSync,
  });
  const {
    trust,
    safetyNumber,
    loading: trustLoading,
    error: trustError,
    markVerified,
    resetTrust,
    refresh: refreshTrust,
  } = useTrustState(!isGroup ? active?.peer_id : null);
  const peerIds = useMemo(
    () => conversations.map((c) => c.peer_id).filter(Boolean),
    [conversations]
  );
  const chatPrivacy = useMemo(
    () => effectivePrivacy(active?.privacy, globalPrivacy),
    [active?.privacy, globalPrivacy]
  );
  const presenceMap = usePresenceMap(peerIds, {
    scopedPeerId: active?.peer_id,
    scopedConversationId: activeId,
  });

  const { peerTyping, onDraftChange, handleSocketPayload } = useTypingIndicator({
    conversationId: activeId,
    userId: user?.id,
    enabled: chatPrivacy.typing_visible,
  });

  const {
    reactionsByTarget,
    sendReaction,
    handleReactionSocketPayload,
    isReactionPending,
  } = useReactions({
    conversationId: activeId,
    enabled: Boolean(user && activeId),
    peerId: active?.peer_id,
    isGroup,
    groupId: activeId,
    userId: user?.id,
    memberIds: active?.participants || [],
    onError: (msg) => setListError(msg),
  });

  const handleSocketEvent = useCallback(
    (data) => {
      const payload = data?.payload || data;
      handleSocketPayload(data);
      handleReactionSocketPayload(payload);
    },
    [handleSocketPayload, handleReactionSocketPayload]
  );

  const storyPeerId = active?.peer_id || peerIds[0] || null;
  const { byUser: storiesByUser, loading: storiesLoading, postStory, removeStory } = useStories(
    user?.id
  );

  const {
    messages,
    pollMeta,
    remainingById,
    sendMessage,
    sendPoll,
    votePoll,
    editMessage,
    deleteMessage,
    forwardMessage,
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

  useEffect(() => {
    if (!activeId || !messages.length) return;
    applyListPatch({ id: activeId, unread_count: 0 });
  }, [activeId, messages.length, applyListPatch]);

  const { nameForId } = useParticipantNames({
    groupId: active?.group_id,
    peerId: active?.peer_id,
    isGroup,
    enabled: Boolean(user && activeId),
  });

  const { togglePin, toggleMute } = useConversationMeta(handleMetaUpdated);
  const { patchPrivacy } = useConversationPrivacy(handleMetaUpdated);

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

  const filteredConversations = useMemo(() => {
    const q = convFilter.trim().toLowerCase();
    if (!q) return sortedConversations;
    return sortedConversations.filter((c) => {
      const label =
        c.type === 'group' ? String(c.group_id || c.id) : String(c.peer_id || c.id);
      return label.toLowerCase().includes(q);
    });
  }, [sortedConversations, convFilter]);

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
    answerGroupCall,
    declineGroupCall,
    endGroupCall,
    error: groupCallError,
    mode: groupCallMode,
  } = useGroupCall({
    conversationId: activeId,
    participantCount: groupParticipantCount,
    participantIds: active?.participants || [],
    userId: user?.id,
    wsToken,
    enabled: Boolean(user && active && isGroup),
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
      listBroadcastLists()
        .then(setBroadcastLists)
        .catch(() => {});
      api
        .get('/api/privacy')
        .then((data) => {
          const settings = data.privacy_settings || {};
          setGlobalPrivacy({
            read_receipts: Boolean(settings.read_receipts),
            last_seen_visible: Boolean(settings.last_seen_visible),
            typing_visible: true,
          });
        })
        .catch(() => {});
      setUserLang(getPreferredLanguage());
    }
    return () => stopPresenceHeartbeat();
  }, [user, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setDisappearingSeconds(chatPrivacy.disappearing_seconds_default || 0);
  }, [activeId, chatPrivacy.disappearing_seconds_default]);

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
        } catch (err) {
          if (err instanceof TranslationError && err.status === 'pending_api_key') {
            if (!cancelled) {
              setListError('Add a translation API key in Settings to auto-translate.');
            }
          }
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

  const installed = isInstalledApp();

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && user && needsUsernameSetup(user)) return <Navigate to="/setup-username" replace />;
  if (loading) return <AuthSplash />;

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
      if (editingMessage) {
        await editMessage(editingMessage.id, text);
        setEditingMessage(null);
      } else {
        await sendMessage(text, {
          disappearingSeconds: disappearingSeconds || undefined,
          replyTo: replyTo?.id,
        });
        setReplyTo(null);
      }
    } catch (err) {
      setDraft(text);
      setListError(err.message);
    }
  }

  async function onBroadcastSend(listId) {
    if (!listId || !draft.trim()) return;
    const list = broadcastLists.find((item) => item.id === listId);
    if (!list?.recipient_ids?.length) {
      setListError('Broadcast list has no recipients');
      return;
    }
    const text = draft;
    setDraft('');
    onDraftChange('');
    setTranslatedPreview('');
    try {
      const result = await sendBroadcastMessage({
        text,
        recipientIds: list.recipient_ids,
        disappearingSeconds: disappearingSeconds || undefined,
      });
      if (result.failed > 0) {
        setListError(`Broadcast sent to ${result.sent}; ${result.failed} failed`);
      }
      await loadConversations();
    } catch (err) {
      setDraft(text);
      setListError(err.message);
    }
  }

  async function onDeleteMessage(message, scope) {
    try {
      await deleteMessage(message.id, scope);
    } catch (err) {
      setListError(err.message);
    }
  }

  function onEditMessage(message) {
    setEditingMessage(message);
    setReplyTo(null);
    setForwardingMessage(null);
    setDraft(message.text || '');
  }

  async function onForwardToConversation(targetConv) {
    if (!forwardingMessage || !targetConv) return;
    try {
      await forwardMessage(
        forwardingMessage,
        targetConv.id,
        targetConv.peer_id,
        targetConv.type === 'group'
      );
      setForwardingMessage(null);
      if (targetConv.id !== activeId) {
        setActiveId(targetConv.id);
      }
    } catch (err) {
      setListError(err.message);
    }
  }

  async function onTranslateDraft() {
    if (!draft.trim()) return;
    try {
      const out = await translateText(draft, { target: translateTarget });
      setTranslatedPreview(out);
    } catch (err) {
      setListError(
        err instanceof TranslationError ? err.message : err.message || 'Translation failed'
      );
    }
  }

  async function onTranslateMessage(message) {
    if (!message?.text) return;
    try {
      const out = await translateText(message.text, { target: userLang });
      setInlineTranslations((prev) => ({ ...prev, [message.id]: out }));
    } catch (err) {
      setListError(
        err instanceof TranslationError ? err.message : err.message || 'Translation failed'
      );
    }
  }

  function onUserLangChange(lang) {
    setUserLang(lang);
    setPreferredLanguage(lang);
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
    if (!active) return '';
    if (isGroup) return `Group ${active.group_id || active.id}`;
    if (active.peer_id && nameForId) {
      const label = nameForId(active.peer_id, user?.id);
      if (label && label !== active.peer_id.slice(0, 10)) return label;
    }
    return active.peer_id;
  }

  function getInitials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  const displayName = user.display_name || user.email?.split('@')[0] || user.id;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <header className={styles.sideTop}>
          <div className={styles.brandRow}>
            <div className={styles.appLogo} aria-hidden="true">
              ssc
            </div>
            <h1 className={styles.sideTitle}>Chats</h1>
          </div>
          <div className={styles.sideActions}>
            <Link to="/settings" className={styles.iconBtn} title="Settings" aria-label="Settings">
              ⚙
            </Link>
          </div>
        </header>

        <div className={styles.profileRow}>
          <div className={styles.avatar} aria-hidden="true">
            {getInitials(displayName)}
          </div>
          <div className={styles.profileMeta}>
            <strong className={styles.profileName}>{displayName}</strong>
            <span className={styles.profileStatus}>End-to-end encrypted</span>
          </div>
          <button type="button" onClick={logout} className={styles.logout} title="Sign out">
            Sign out
          </button>
        </div>

        <label className={styles.convSearchWrap}>
          <span className={styles.srOnly}>Search conversations</span>
          <input
            className={styles.convSearch}
            placeholder="Search chats"
            value={convFilter}
            onChange={(e) => setConvFilter(e.target.value)}
          />
        </label>

        <StoriesBar
          byUser={storiesByUser}
          userId={user?.id}
          peerIds={peerIds}
          loading={storiesLoading}
          onPost={(text) => postStory(text, { peerId: storyPeerId })}
          onDelete={removeStory}
        />

        <UserLookup onStartChat={startChat} />
        <FriendRequestsPanel
          onAccepted={(conversationId) => {
            loadConversations();
            setActiveId(conversationId);
          }}
        />
        <GroupPanel onGroupCreated={onGroupCreated} />

        {listError && <p className={styles.error}>{String(listError)}</p>}
        {fileError && <p className={styles.error}>{String(fileError)}</p>}

        <ul className={styles.convList}>
          {filteredConversations.length === 0 && convFilter.trim() && (
            <li className={styles.convEmpty}>No chats match your search.</li>
          )}
          {filteredConversations.map((c) => (
            <li
              key={c.id}
              className={`${styles.convItem} ${c.muted ? styles.convMuted : ''} ${
                c.pinned ? styles.convPinned : ''
              }`}
            >
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
                    {c.type === 'group' && <GroupE2EBadge compact />}
                    {c.type !== 'group' && c.peer_id && getPeerTrust(c.peer_id).status === 'verified' && (
                      <span className={styles.trustVerified} title="Verified"> ✓</span>
                    )}
                    {c.type !== 'group' && c.peer_id && getPeerTrust(c.peer_id).status === 'changed' && (
                      <span className={styles.trustChanged} title="Safety number changed"> ⚠</span>
                    )}
                  </span>
                  <span className={styles.convMeta}>
                    {c.unread_count > 0 && c.id !== activeId && (
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
        <Link to="/link-device" className={styles.syncLink}>
          Linked devices &amp; sync
        </Link>
        {!installed && (
          <Link to="/" className={styles.homeLink}>
            ← Website
          </Link>
        )}
      </aside>

      <main className={styles.thread}>
        {!active ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyLogo} aria-hidden="true">
              ssc
            </div>
            <h2 className={styles.emptyTitle}>Super Secure Chat</h2>
            <p className={styles.emptySub}>
              Select a conversation on the left, or start a new encrypted chat above.
            </p>
            <p className={styles.emptyHint}>Messages are encrypted on your device before they leave.</p>
          </div>
        ) : (
          <>
            <header className={styles.threadHeader}>
              <div className={styles.threadTitleRow}>
                <div className={styles.threadTitle}>
                  <span>
                    Chat with <strong>{getThreadTitle()}</strong>
                  </span>
                  {presenceMap[active.peer_id] && (
                    <span className={styles.presenceLabel}>{presenceMap[active.peer_id]}</span>
                  )}
                  {peerTyping && <span className={styles.typing}>typing…</span>}
                  {active?.muted && (
                    <span className={styles.threadMetaChip} title="Notifications muted">
                      Muted
                    </span>
                  )}
                  {active?.pinned && (
                    <span className={styles.threadMetaChip} title="Pinned chat">
                      Pinned
                    </span>
                  )}
                </div>
                <div className={styles.threadHeaderActions}>
                  {isGroup && <GroupE2EBadge />}
                  {!isGroup && active?.peer_id && (
                    <SafetyVerifyButton
                      trust={trust}
                      disabled={trustLoading}
                      onClick={() => setShowSafetyVerify(true)}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.privacyBtn}
                    onClick={() => setShowPrivacyPanel((v) => !v)}
                  >
                    Privacy
                  </button>
                </div>
              </div>
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

            {isGroup && <GroupE2EBanner />}

            {!isGroup && (
              <TrustBanner trust={trust} onVerify={() => setShowSafetyVerify(true)} />
            )}

            <ChatPrivacyPanel
              open={showPrivacyPanel}
              onClose={() => setShowPrivacyPanel(false)}
              overrides={active?.privacy || {}}
              globalSettings={globalPrivacy}
              onPatch={async (patch) => {
                if (!activeId) return;
                await patchPrivacy(activeId, patch);
              }}
            />

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
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                    onForward={setForwardingMessage}
                    onReaction={sendReaction}
                    reactionPending={isReactionPending(m.id)}
                    onTranslate={onTranslateMessage}
                    downloadFile={downloadFile}
                    readReceipts={readByMessage[m.id] || []}
                    isGroup={isGroup}
                    nameForId={nameForId}
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

            {editingMessage && (
              <div className={styles.replyBar}>
                <span>Editing message</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setDraft('');
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {forwardingMessage && (
              <div className={styles.replyBar}>
                <span>Forward to:</span>
                <select
                  value=""
                  onChange={(e) => {
                    const conv = conversations.find((c) => c.id === e.target.value);
                    if (conv) onForwardToConversation(conv);
                  }}
                >
                  <option value="">Choose chat…</option>
                  {conversations
                    .filter((c) => c.id !== activeId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type === 'group' ? `Group ${c.id.slice(0, 8)}` : c.peer_id?.slice(0, 12)}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => setForwardingMessage(null)}>
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
              onUserLangChange={onUserLangChange}
              languages={languages}
              disappearingSeconds={disappearingSeconds}
              onDisappearingChange={setDisappearingSeconds}
              recording={recording}
              onVoiceToggle={() => (recording ? stopRecording() : startRecording())}
              uploading={uploading}
              onFileSelected={onFileSelected}
              onCreatePoll={!isGroup && active?.peer_id ? () => setShowPollForm(true) : undefined}
              broadcastLists={broadcastLists}
              onBroadcastSend={broadcastLists.length ? onBroadcastSend : undefined}
            />
          </>
        )}
      </main>

      <SafetyVerifyModal
        open={showSafetyVerify}
        peerId={active?.peer_id}
        peerLabel={active?.peer_id ? nameForId(active.peer_id, user?.id) : ''}
        trust={trust}
        safetyNumber={safetyNumber}
        loading={trustLoading}
        error={trustError}
        onMarkVerified={markVerified}
        onResetTrust={resetTrust}
        onRefresh={refreshTrust}
        onClose={() => setShowSafetyVerify(false)}
      />

      <CallModal
        open={callOpen || groupCallOpen}
        status={groupCallOpen ? groupCallStatus : callStatus}
        peerLabel={isGroup ? getThreadTitle() : active?.peer_id}
        isVideo={Boolean(activeCall?.video) || groupRemoteStreams.length > 0}
        localStream={groupCallOpen ? groupLocalStream : localStream}
        remoteStream={groupCallOpen ? groupRemoteStreams[0] || null : remoteStream}
        errorMessage={groupCallOpen ? groupCallError : callErrorMessage}
        onAnswer={groupCallOpen ? answerGroupCall : answerCall}
        onDecline={groupCallOpen ? declineGroupCall : declineCall}
        onEnd={groupCallOpen ? endGroupCall : endCall}
      />
    </div>
  );
}