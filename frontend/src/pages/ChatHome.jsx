/**
 * Chat home screen — orchestration only.
 * UI lives under components/chat/home/*; display helpers under chat/home/*.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthSplash from '../components/AuthSplash';
import CallModal from '../components/chat/CallModal';
import SafetyVerifyModal from '../components/chat/SafetyVerifyModal';
import {
  ConversationSidebar,
  ChatThread,
} from '../components/chat/home';
import { useCall } from '../chat/useCall';
import { useGroupCall } from '../calls/useGroupCall';
import { useChatMessages } from '../chat/useChatMessages';
import { useReactions } from '../chat/useReactions';
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
import { formatApiError } from '../lib/apiErrors';
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
import { getInstalledClientHeader } from '../lib/installedClient';
import { checkBlockedBy } from '../lib/abuseReport';
import { getLocalDeviceId } from '../lib/deviceLink';
import { runMessageRecordMaintenance } from '../signal/messageRecords';
import { handleDecryptRetryRequest } from '../signal/sesameRetry';
import { showDesktopNotification } from '../lib/desktopNotify';
import { registerDeviceAndPrekeys } from '../signal/signalBridge';
import { isInstalledApp } from '../lib/appMode';
import { needsUsernameSetup } from '../lib/onboarding';
import {
  bumpUnread,
  mergeConversationMeta,
  patchConversationInList,
} from '../lib/conversationMeta';
import { shouldAutoTranslate } from '../lib/languageDetect';
import {
  filterConversations,
  getThreadTitle,
  sortConversations,
} from '../chat/home/displayUtils';
import { useMobileLayout } from '../chat/home/useMobileLayout';
import { useConversationDirectory } from '../chat/home/useConversationDirectory';
import styles from './ChatHome.module.css';

export default function ChatHome() {
  const location = useLocation();
  const { user, wsToken, loading } = useAuth();
  const isMobileLayout = useMobileLayout();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [listError, setListError] = useState(null);
  const [chatError, setChatError] = useState(null);
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
  const [newChatOpen, setNewChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

  useEffect(() => {
    setChatError(null);
  }, [activeId]);

  useEffect(() => {
    const openId = location.state?.openConversationId;
    if (openId) setActiveId(openId);
  }, [location.state?.openConversationId]);

  useEffect(() => {
    runMessageRecordMaintenance();
  }, []);

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
    async (payload) => {
      if (payload?.type === 'decrypt_retry_request' && user?.id) {
        await handleDecryptRetryRequest(payload, {
          localUserId: user.id,
          localDeviceId: getLocalDeviceId(),
        });
        return;
      }
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

      if (payload.message?.sender_id && payload.message.sender_id !== user?.id) {
        const inBackground =
          convId !== activeId || document.hidden || !document.hasFocus();
        if (inBackground) {
          showDesktopNotification({
            title: 'SSC',
            body: 'New message',
          });
        }
      }
    },
    [activeId, loadConversations, refreshActiveConversation, user?.id]
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
  const {
    byUser: storiesByUser,
    loading: storiesLoading,
    postStory,
    removeStory,
  } = useStories(user?.id);

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
    error: messagesError,
    reload: reloadMessages,
  } = useChatMessages(activeId, Boolean(user), active?.peer_id, {
    onSocketEvent: handleSocketEvent,
    wsToken,
    isGroup,
    groupId: active?.group_id || (isGroup ? activeId : undefined),
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

  const sortedConversations = useMemo(
    () => sortConversations(conversations),
    [conversations]
  );
  const { titleFor } = useConversationDirectory(conversations);

  const filteredConversations = useMemo(() => {
    const q = convFilter.trim().toLowerCase();
    if (!q) return sortedConversations;
    return sortedConversations.filter((c) => {
      const label = String(titleFor(c) || '').toLowerCase();
      const raw = filterConversations([c], convFilter);
      return label.includes(q) || raw.length > 0;
    });
  }, [sortedConversations, convFilter, titleFor]);

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
    for (const m of messages) map[m.id] = m;
    return map;
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadConversations();
      startPresenceHeartbeat();
      registerDeviceAndPrekeys({
        deviceId: getLocalDeviceId(),
        deviceName: 'SSC Client',
        platform: getInstalledClientHeader().split('/')[0] || 'electron',
        localUserId: user.id,
      }).catch((err) => {
        const msg = formatApiError(err, 'Encryption setup failed. Close and reopen SSC.');
        setListError(msg);
        setChatError(msg);
        console.warn('[ssc] prekey registration failed', err?.message || err);
      });
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
          if (err instanceof TranslationError && !cancelled) {
            setListError(
              err.message ||
                'Auto-translate is not available yet. SSC will enable translation on the server when ready.'
            );
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
  if (!loading && user && needsUsernameSetup(user)) {
    return <Navigate to="/setup-username" replace />;
  }
  if (loading) return <AuthSplash />;

  async function startChat(participantId) {
    if (!participantId?.trim()) return;
    try {
      const blocked = await checkBlockedBy(participantId.trim());
      if (blocked) {
        setListError('You are blocked by this user');
        return;
      }
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
    setChatError(null);
    try {
      if (editingMessage) {
        await editMessage(editingMessage.id, text);
        setEditingMessage(null);
        setDraft('');
        onDraftChange('');
        setTranslatedPreview('');
      } else {
        await sendMessage(text, {
          disappearingSeconds: disappearingSeconds || undefined,
          replyTo: replyTo?.id,
        });
        setDraft('');
        onDraftChange('');
        setTranslatedPreview('');
        setReplyTo(null);
      }
    } catch (err) {
      setDraft(text);
      onDraftChange(text);
      const msg = formatApiError(err, 'Message could not be sent');
      setChatError(msg);
      setListError(msg);
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
    setChatError(null);
    try {
      const result = await sendBroadcastMessage({
        text,
        recipientIds: list.recipient_ids,
        disappearingSeconds: disappearingSeconds || undefined,
      });
      setDraft('');
      onDraftChange('');
      setTranslatedPreview('');
      if (result.failed > 0) {
        const msg = `Broadcast sent to ${result.sent}; ${result.failed} failed`;
        setChatError(msg);
        setListError(msg);
      }
      await loadConversations();
    } catch (err) {
      setDraft(text);
      onDraftChange(text);
      const msg = formatApiError(err, 'Broadcast could not be sent');
      setChatError(msg);
      setListError(msg);
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

  async function onPostPoll() {
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || options.length < 2) return;
    setChatError(null);
    try {
      await sendPoll(pollQuestion, options);
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollForm(false);
    } catch (err) {
      const msg = formatApiError(err, 'Poll could not be posted');
      setChatError(msg);
      setListError(msg);
    }
  }

  const mobileChatOpen = isMobileLayout && Boolean(activeId);
  const threadTitle =
    (active && titleFor(active)) ||
    getThreadTitle(active, {
      isGroup,
      nameForId,
      userId: user?.id,
    });

  function selectConversation(id) {
    setActiveId(id);
    setSearchQuery('');
    setInlineTranslations({});
    setReplyTo(null);
  }

  // P0: mobile = full-screen list OR full-screen thread (never both)
  const layoutClassName = [
    styles.layout,
    isMobileLayout ? styles.layoutMobile : '',
    isMobileLayout && !activeId ? styles.layoutMobileList : '',
    mobileChatOpen ? styles.layoutMobileChat : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClassName}>
      <ConversationSidebar
        convFilter={convFilter}
        onConvFilterChange={setConvFilter}
        storiesByUser={storiesByUser}
        userId={user?.id}
        peerIds={peerIds}
        storiesLoading={storiesLoading}
        storyPeerId={storyPeerId}
        onPostStory={postStory}
        onDeleteStory={removeStory}
        onStartChat={startChat}
        onFriendAccepted={(conversationId) => {
          loadConversations();
          setActiveId(conversationId);
          setNewChatOpen(false);
        }}
        onGroupCreated={(conversationId) => {
          onGroupCreated(conversationId);
          setNewChatOpen(false);
        }}
        listError={listError}
        fileError={fileError}
        conversations={filteredConversations}
        activeId={activeId}
        presenceMap={presenceMap}
        titleFor={titleFor}
        onSelectConversation={selectConversation}
        onTogglePin={togglePin}
        onToggleMute={toggleMute}
        showWebsiteLink={!installed}
        newChatOpen={newChatOpen}
        onOpenNewChat={() => setNewChatOpen(true)}
        onCloseNewChat={() => setNewChatOpen(false)}
      />

      <ChatThread
        active={active}
        isGroup={isGroup}
        mobileChat={mobileChatOpen}
        onMobileBack={() => setActiveId(null)}
        threadTitle={threadTitle}
        presenceLabel={presenceMap[active?.peer_id]}
        peerTyping={peerTyping}
        encryptionError={chatError || listError}
        trust={trust}
        trustLoading={trustLoading}
        onOpenSafetyVerify={() => setShowSafetyVerify(true)}
        showPrivacyPanel={showPrivacyPanel}
        onTogglePrivacy={() => setShowPrivacyPanel((v) => !v)}
        onClosePrivacy={() => setShowPrivacyPanel(false)}
        onPatchPrivacy={async (patch) => {
          if (!activeId) return;
          await patchPrivacy(activeId, patch);
        }}
        globalPrivacy={globalPrivacy}
        onStartAudioCall={() => startCall(false)}
        onStartVideoCall={() => startCall(true)}
        onStartGroupAudioCall={() => startGroupCall(false)}
        onStartGroupVideoCall={() => startGroupCall(true)}
        groupCallError={groupCallError}
        groupCallMode={groupCallMode}
        groupParticipantCount={groupParticipantCount}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchHits={searchHits}
        onSelectSearchHit={scrollToMessage}
        messages={messages}
        messagesLoading={messagesLoading}
        messagesError={messagesError}
        onReloadMessages={() => reloadMessages()}
        userId={user.id}
        inlineTranslations={inlineTranslations}
        reactionsByTarget={reactionsByTarget}
        getReplyPreview={getReplyPreview}
        highlightedId={highlightedId}
        onReply={setReplyTo}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onForward={setForwardingMessage}
        onReaction={sendReaction}
        isReactionPending={isReactionPending}
        onTranslateMessage={onTranslateMessage}
        downloadFile={downloadFile}
        readByMessage={readByMessage}
        nameForId={nameForId}
        pollMeta={pollMeta}
        remainingById={remainingById}
        votePoll={votePoll}
        messageRefs={messageRefs}
        messagesEndRef={messagesEndRef}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        editingMessage={editingMessage}
        onClearEdit={() => {
          setEditingMessage(null);
          setDraft('');
        }}
        forwardingMessage={forwardingMessage}
        conversations={conversations}
        activeId={activeId}
        onForwardTo={onForwardToConversation}
        onClearForward={() => setForwardingMessage(null)}
        showPollForm={showPollForm}
        pollQuestion={pollQuestion}
        pollOptions={pollOptions}
        onPollQuestionChange={setPollQuestion}
        onPollOptionChange={(idx, value) => {
          const next = [...pollOptions];
          next[idx] = value;
          setPollOptions(next);
        }}
        onPostPoll={onPostPoll}
        onCancelPoll={() => setShowPollForm(false)}
        chatError={chatError}
        draft={draft}
        onDraftChange={(value) => {
          setDraft(value);
          onDraftChange(value);
        }}
        onSend={onSend}
        onTranslateDraft={onTranslateDraft}
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
        onCreatePoll={() => setShowPollForm(true)}
        broadcastLists={broadcastLists}
        onBroadcastSend={onBroadcastSend}
      />

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
        peerLabel={isGroup ? threadTitle : active?.peer_id}
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
