import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MagnifyingGlass, Plus, SignOut, Phone, VideoCamera, PaperPlaneTilt, Paperclip, ShieldCheck, Translate, X, UsersThree, Gear, Microphone, CaretLeft } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ChatSocket } from '../lib/socket';
import { decryptMessage, encryptBytesForRecipients, encryptMessageForRecipients, b64ToBytes } from '../lib/crypto';

import { subscribePush } from '../lib/push';
import { subscribeNativePush } from '../lib/native-push';
import Message from '../components/Message';
import PanicButton from '../components/PanicButton';
import CallModal from '../components/CallModal';
import SettingsModal from '../components/SettingsModal';
import OnboardingCoach, { hasCompletedOnboarding } from '../components/OnboardingCoach';
import Avatar from '../components/Avatar';
import ConfirmDialog from '../components/ConfirmDialog';
import CreateGroupModal from '../components/CreateGroupModal';
import ConversationActionsSheet, { ConversationListRow } from '../components/ConversationActionsSheet';
import { useLocale } from '../context/LocaleContext';
import { useMobileLayout } from '../lib/use-mobile';
import MobileChatMenu, { MenuAction } from '../components/MobileChatMenu';
import GroupCallModal from '../components/GroupCallModal';
import { StoriesBar, StoryViewer } from '../components/Stories';
import ContactsModal from '../components/ContactsModal';
import { formatPeerPresence } from '../lib/presence';
import {
  isContactRealtimeEvent,
  subscribeContactsRefresh,
} from '../lib/contactRealtime';
import { chatListPath, chatNavigateOptions, chatThreadPath } from '../lib/chatNavigation';
import {
  clearNativeBackHandler,
  minimizeNativeApp,
  setNativeBackHandler,
} from '../lib/nativeBack';
import { isInstalledClient, isNativeApp } from '../lib/platform';
import { bootstrapSignalIdentity } from '../lib/signalIdentityBootstrap';
import { ensureMediaPermissions } from '../lib/mediaPermissions';
import { startIncomingRingtone, stopIncomingRingtone } from '../lib/callRingtone';
import {
  MIN_VOICE_BLOB_BYTES,
  startVoiceRecording,
  voiceFilenameForMime,
} from '../lib/voiceRecorder';
import {
  isPeerBlocked,
  isPeerMuted,
  visibleConversations,
} from '../lib/contactFilters';
import { formatGroupConversationLabel } from '../lib/groupDisplayLabel';
import { clearLocalGroupLabels } from '../lib/groupLabels';

import { registerMemoryWipeHandler, registerSocketCloser } from '../lib/memoryWipe';
import { getSessionToken } from '../lib/sessionStore';
import { ensureSignalSession } from '../lib/signal/x3dh';
import { encryptAttachmentBytes, encryptSignalAttachment } from '../lib/signal/attachments';
import {
  ensureGroupSenderKeysDistributed,
  encryptGroupText,
  processIncomingSkdmMessage,
} from '../lib/signal/groupMessages';
import { SKDM_MESSAGE_TYPE } from '../lib/signal/constants';
import { STATUS_SKDM_MESSAGE_TYPE, processIncomingStatusSkdmMessage } from '../lib/signal/statuses';
import { encryptSignalText } from '../lib/signal/messages';
import { ProtocolVersion } from '../lib/signal/constants';
import {
  decryptMessageBody,
} from '../lib/signal/migration';
import { fetchRetentionConfig } from '../lib/publicConfig';
import {
  prepareInstalledMessaging,
  usesSignalOnlyMessaging,
} from '../lib/signal/installedMessaging';
import { unpackIncomingSignaling } from '../lib/signal/webrtcSignaling';

const PENDING_CALL_KEY = 'ssc_pending_call';

export default function ChatHome() {
  const { user, privateKey, logout, panicWipe, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageFilter, setMessageFilter] = useState('');
  const [decryptedBodies, setDecryptedBodies] = useState({});
  const [draft, setDraft] = useState('');
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [translationOnDevice, setTranslationOnDevice] = useState(false);
  const [serverTranslationAllowed, setServerTranslationAllowed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [myContacts, setMyContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  const [contactsOpen, setContactsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const voiceRecordingRef = useRef(null);
  const [typingFrom, setTypingFrom] = useState(null);
  const [callState, setCallState] = useState(null); // { mode, direction, peer, signal }
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState(null);
  const [mobileMsgSearchOpen, setMobileMsgSearchOpen] = useState(false);
  const userNearBottomRef = useRef(true);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [storyGroup, setStoryGroup] = useState(null);
  const [groupCallState, setGroupCallState] = useState(null); // {mode, direction, members, signal}
  const [convActionsTarget, setConvActionsTarget] = useState(null);
  const [reads, setReads] = useState([]); // [{user_id, last_read_message_id}]
  const [retentionHours, setRetentionHours] = useState(24);
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const refreshContactsRosterRef = useRef(null);

  useEffect(() => {
    const closeSocket = () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
    const unsubSocket = registerSocketCloser(closeSocket);
    const unsubWipe = registerMemoryWipeHandler(() => {
      closeSocket();
      setMessages([]);
      setDecryptedBodies({});
      setDraft('');
      setConversations([]);
      setReads([]);
      setMessageFilter('');
      setTypingFrom(null);
      setStoryGroup(null);
      setCallState(null);
      setGroupCallState(null);
      stopIncomingRingtone();
      clearLocalGroupLabels();
      setActiveId(null);
    });
    return () => {
      unsubSocket();
      unsubWipe();
    };
  }, []);

  const sidebarConversations = useMemo(
    () => visibleConversations(conversations, myContacts),
    [conversations, myContacts],
  );
  const acceptedContacts = useMemo(
    () => myContacts
      .filter((c) => !c.blocked)
      .sort((a, b) => (a.username || '').localeCompare(b.username || '')),
    [myContacts],
  );

  const activeConv = useMemo(
    () => sidebarConversations.find((c) => c.conversation_id === activeId)
      || conversations.find((c) => c.conversation_id === activeId),
    [sidebarConversations, conversations, activeId],
  );
  const peer = activeConv?.peer;
  const isGroup = !!activeConv?.is_group;
  const { t } = useLocale();
  const headerTitle = isGroup
    ? (formatGroupConversationLabel(activeConv) || t('group'))
    : (peer ? `@${peer.username}` : '');
  const isMobile = useMobileLayout();
  const showList = !isMobile || !activeId;
  const showChatPanel = !isMobile || !!activeId;
  const sameLangAsPeer = !isGroup && peer?.language && user?.language
    && peer.language.toLowerCase() === user.language.toLowerCase();
  const showTranslateControls = translationEnabled && !sameLangAsPeer;
  const peerContact = peer ? myContacts.find((c) => c.user_id === peer.user_id) : null;
  const canMessagePeer = isGroup || !peer || (!!peerContact && !peerContact.blocked);
  const isRequestPendingPeer = !isGroup && !!peer
    && outgoingRequests.some((r) => r.to_user_id === peer.user_id);

  useEffect(() => {
    (async () => {
      try {
        const { resolveTranslationAvailability } = await import('../lib/translation/translateClient');
        const avail = await resolveTranslationAvailability();
        setTranslationOnDevice(avail.onDevice);
        setServerTranslationAllowed(avail.serverAllowed);
        setTranslationEnabled(avail.enabled);
      } catch {
        setTranslationEnabled(false);
        setTranslationOnDevice(false);
        setServerTranslationAllowed(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const retention = await fetchRetentionConfig();
      if (!cancelled) setRetentionHours(retention.hours);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!translationEnabled) setAutoTranslate(false);
  }, [translationEnabled]);

  // Decrypt message bodies client-side for in-chat search (E2E — server never sees plaintext)
  useEffect(() => {
    if (!user?.user_id || messages.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const m of messages) {
        try {
          next[m.message_id] = await decryptMessageBody(m, {
            myUserId: user.user_id,
            peerUserId: peer?.user_id,
            privateKey,
          });
        } catch {
          /* skip undecryptable */
        }
      }
      if (!cancelled) setDecryptedBodies(next);
    })();
    return () => { cancelled = true; };
  }, [messages, privateKey, user?.user_id, peer?.user_id]);

  const filteredMessages = useMemo(() => {
    const q = messageFilter.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      if (m.sender_id === user?.user_id && user?.username?.toLowerCase().includes(q)) return true;
      if (isGroup && activeConv?.members) {
        const sender = activeConv.members.find((mem) => mem.user_id === m.sender_id);
        if (sender?.username?.toLowerCase().includes(q)) return true;
      } else if (m.sender_id !== user?.user_id && peer?.username?.toLowerCase().includes(q)) return true;
      const body = decryptedBodies[m.message_id];
      return body && body.toLowerCase().includes(q);
    });
  }, [messages, messageFilter, decryptedBodies, user, peer, isGroup, activeConv]);

  // Build recipients map for outgoing message encryption
  const recipientsForActive = useMemo(() => {
    if (!activeConv || !user) return {};
    const myPub = user.public_key ? (typeof user.public_key === 'string' ? JSON.parse(user.public_key) : user.public_key) : null;
    const map = { [user.user_id]: myPub };
    if (isGroup && activeConv.members) {
      for (const m of activeConv.members) {
        if (m.public_key) map[m.user_id] = typeof m.public_key === 'string' ? JSON.parse(m.public_key) : m.public_key;
      }
    } else if (peer?.public_key) {
      map[peer.user_id] = typeof peer.public_key === 'string' ? JSON.parse(peer.public_key) : peer.public_key;
    }
    return map;
  }, [activeConv, user, peer, isGroup]);

  // ─── Load conversations ────
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data);
    } catch {
      /* ignore */
    }
  }, []);
  const goToConversation = useCallback((id) => {
    setActiveId(id);
    if (id) {
      navigate(chatThreadPath(id), chatNavigateOptions(id));
    } else {
      navigate(chatListPath(), chatNavigateOptions(null));
    }
  }, [navigate]);

  const leaveChat = useCallback(() => {
    setChatMenuOpen(false);
    setMobileMsgSearchOpen(false);
    setMessageFilter('');
    goToConversation(null);
  }, [goToConversation]);

  useEffect(() => {
    setActiveId(conversationId || null);
  }, [conversationId]);

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    setNativeBackHandler(() => {
      if (confirmRemoveUid) {
        setConfirmRemoveUid(null);
        return;
      }
      if (chatMenuOpen) {
        setChatMenuOpen(false);
        return;
      }
      if (mobileMsgSearchOpen) {
        setMobileMsgSearchOpen(false);
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (contactsOpen) {
        setContactsOpen(false);
        return;
      }
      if (searchOpen) {
        setSearchOpen(false);
        return;
      }
      if (groupOpen) {
        setGroupOpen(false);
        return;
      }
      if (onboardingOpen) {
        setOnboardingOpen(false);
        return;
      }
      if (storyGroup) {
        setStoryGroup(null);
        return;
      }
      if (callState?.direction === 'incoming') {
        rejectCall();
        return;
      }
      if (groupCallState?.direction === 'incoming') {
        rejectGroupCall();
        return;
      }
      if (conversationId || activeId) {
        leaveChat();
        return;
      }
      minimizeNativeApp();
    });
    return () => clearNativeBackHandler();
  }, [
    activeId,
    chatMenuOpen,
    confirmRemoveUid,
    contactsOpen,
    conversationId,
    groupOpen,
    leaveChat,
    mobileMsgSearchOpen,
    onboardingOpen,
    searchOpen,
    settingsOpen,
    storyGroup,
    callState,
    groupCallState,
  ]);

  const hasIncomingCall = (callState?.direction === 'incoming')
    || (groupCallState?.direction === 'incoming');

  useEffect(() => {
    if (hasIncomingCall) {
      startIncomingRingtone();
    } else {
      stopIncomingRingtone();
    }
    return () => stopIncomingRingtone();
  }, [hasIncomingCall]);

  const handlePendingCall = useCallback(async (payload) => {
    const data = payload?.data || payload;
    if (!data?.from) return;
    try {
      const { data: peerData } = await api.get(`/users/${data.from}/public`);
      const mode = data.mode || 'audio';
      if (data.conversation_id) goToConversation(data.conversation_id);
      if (payload?.action === 'decline') {
        socketRef.current?.send({ type: 'call-reject', to: data.from });
        return;
      }
      if (data.group) {
        const members = (data.members || []).filter((m) => m.user_id !== user?.user_id);
        if (members.length === 0) members.push({ user_id: data.from, username: peerData.username });
        setGroupCallState({
          mode,
          direction: payload?.action === 'answer' ? 'incoming-accepted' : 'incoming',
          members,
          signal: { from: data.from, from_username: peerData.username, sdp: data.sdp, members: data.members },
        });
      } else {
        setCallState({
          mode,
          direction: payload?.action === 'answer' ? 'incoming-accepted' : 'incoming',
          peer: peerData,
          signal: data.sdp ? { sdp: data.sdp } : null,
        });
      }
    } catch {}
  }, [goToConversation, user?.user_id]);

  useEffect(() => {
    const onCallEnded = () => {
      stopIncomingRingtone();
      setCallState(null);
      setGroupCallState(null);
    };
    window.addEventListener('ssc-call-ended', onCallEnded);
    return () => window.removeEventListener('ssc-call-ended', onCallEnded);
  }, []);

  useEffect(() => {
    if (!user?.user_id || !activeId || !activeConv) return;
    (async () => {
      if (!isGroup && peer?.user_id) {
        await ensureSignalSession(peer.user_id, user.user_id).catch(() => {});
      }
    })();
  }, [user?.user_id, activeId, activeConv, isGroup, peer?.user_id]);

  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_CALL_KEY);
    if (raw) {
      sessionStorage.removeItem(PENDING_CALL_KEY);
      try { handlePendingCall(JSON.parse(raw)); } catch {}
    }
    const h = (e) => handlePendingCall(e.detail);
    window.addEventListener('ssc-call-notification', h);
    return () => window.removeEventListener('ssc-call-notification', h);
  }, [handlePendingCall]);

  const loadMyContacts = useCallback(async () => {
    try {
      const { data } = await api.get('/contacts');
      setMyContacts(data);
    } catch {}
  }, []);

  const loadPendingRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/contacts/requests');
      setPendingRequests(data);
    } catch {}
    try {
      const { data } = await api.get('/contacts/requests/sent');
      setOutgoingRequests(data);
    } catch {}
  }, []);

  const refreshContactsRoster = useCallback(async ({ full = false } = {}) => {
    await loadPendingRequests();
    if (full) {
      await loadMyContacts();
      await loadConversations();
    }
  }, [loadConversations, loadMyContacts, loadPendingRequests]);

  useEffect(() => {
    refreshContactsRosterRef.current = refreshContactsRoster;
  }, [refreshContactsRoster]);

  useEffect(() => {
    if (!user?.user_id) return;
    refreshContactsRoster({ full: true });
  }, [user?.user_id, refreshContactsRoster]);

  useEffect(() => {
    if (!user?.user_id) return undefined;
    return subscribeContactsRefresh((detail) => {
      const full = detail?.type === 'friend_accept' || detail?.full;
      refreshContactsRosterRef.current?.({ full });
    });
  }, [user?.user_id]);

  const sendFriendRequest = async (u) => {
    await api.post('/contacts/request', { username: u.username });
    toast.success(`Friend request sent to @${u.username}`);
    await loadPendingRequests();
  };

  const acceptRequest = async (reqId) => {
    try {
      await api.post('/contacts/requests/accept', { request_id: reqId });
      toast.success('Request accepted');
      await loadPendingRequests();
      await loadMyContacts();
      await loadConversations();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed');
    }
  };

  const rejectRequest = async (reqId) => {
    try {
      await api.post('/contacts/requests/reject', { request_id: reqId });
      toast.success('Request rejected');
      await loadPendingRequests();
    } catch (e) {
      toast.error('Failed');
    }
  };

  const toggleBlock = async (uid) => {
    const c = myContacts.find((x) => x.user_id === uid);
    if (!c) return;
    const wasBlocked = c.blocked;
    try {
      if (wasBlocked) {
        await api.post(`/contacts/${uid}/unblock`);
      } else {
        await api.post(`/contacts/${uid}/block`);
      }
      await loadMyContacts();
      await loadConversations();
      toast.success(wasBlocked ? t('contactUnblocked') : t('contactBlocked'));
      if (!wasBlocked && peer?.user_id === uid) {
        leaveChat();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateContact'));
    }
  };

  const toggleMute = async (uid) => {
    const c = myContacts.find((x) => x.user_id === uid);
    if (!c) return;
    const wasMuted = c.muted;
    try {
      if (wasMuted) {
        await api.post(`/contacts/${uid}/unmute`);
      } else {
        await api.post(`/contacts/${uid}/mute`);
      }
      await loadMyContacts();
      toast.success(wasMuted ? t('contactUnmuted') : t('contactMuted'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateContact'));
    }
  };

  const removeContact = (uid) => {
    setConfirmRemoveUid(uid);
  };

  const deleteConversation = async (conv) => {
    if (!conv?.conversation_id) return;
    try {
      await api.delete(`/conversations/${conv.conversation_id}`);
      await loadConversations();
      if (activeId === conv.conversation_id) leaveChat();
      toast.success(conv.is_group ? t('leftGroup') : t('chatDeleted'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotDeleteChat'));
    }
  };

  const confirmRemoveContact = async () => {
    const uid = confirmRemoveUid;
    if (!uid) return;
    setConfirmRemoveUid(null);
    try {
      await api.delete(`/contacts/${uid}`);
      await loadMyContacts();
      await loadConversations();
      toast.success(t('contactRemoved'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateContact'));
    }
  };

  useEffect(() => {
    if (!user?.user_id) return;
    if (!hasCompletedOnboarding(user.user_id) && !conversationId) {
      setOnboardingOpen(true);
    }
  }, [user?.user_id, conversationId]);

  useEffect(() => {
    if (activeId && onboardingOpen) {
      setOnboardingOpen(false);
    }
  }, [activeId, onboardingOpen]);

  useEffect(() => {
    if (!user?.user_id || !isInstalledClient()) return;
    (async () => {
      await bootstrapSignalIdentity(refreshUser).catch(() => {});
      await refreshUser();
    })();
  }, [user?.user_id, refreshUser]);

  // Register push as soon as user is logged in (does not require vault unlock)
  useEffect(() => {
    if (!user) return;
    subscribePush().catch(() => {});
    subscribeNativePush()
      .then((ok) => { if (ok) toast.success('Push notifications enabled'); })
      .catch(() => {});
  }, [user]);

  // ─── Socket ───
  useEffect(() => {
    if (!user) return;
    const s = new ChatSocket(getSessionToken(), {
      onMessage: (data) => {
        if (data.type === 'message') {
          const incoming = data.data;
          if (incoming?.message_type === SKDM_MESSAGE_TYPE) {
            processIncomingSkdmMessage(incoming, {
              myUserId: user.user_id,
              peerUserId: peer?.user_id,
            }).catch(() => {});
          } else if (incoming?.message_type === STATUS_SKDM_MESSAGE_TYPE) {
            processIncomingStatusSkdmMessage(incoming, {
              myUserId: user.user_id,
              peerUserId: incoming.sender_id !== user.user_id ? incoming.sender_id : peer?.user_id,
            }).catch(() => {});
          } else if (incoming.conversation_id === activeId) {
            setMessages((m) => [...m, incoming]);
          }
          loadConversations();
        } else if (data.type === 'typing') {
          if (data.conversation_id === activeId && data.user_id !== user?.user_id) {
            setTypingFrom(data.username);
            setTimeout(() => setTypingFrom(null), 2500);
          }
        } else if (data.type === 'call-offer') {
          // incoming call
          (async () => {
            let offer = data;
            if (user?.user_id) {
              try {
                offer = await unpackIncomingSignaling(data, {
                  myUserId: user.user_id,
                  peerUserId: data.from,
                });
              } catch {
                return;
              }
            }
            const { data: peerData } = await api.get(`/users/${offer.from}/public`);
            if (offer.group) {
              // Group call: offer carries members list
              const members = (offer.members || []).filter((m) => m.user_id !== user?.user_id);
              if (members.length === 0) members.push({ user_id: offer.from, username: peerData.username });
              setGroupCallState({ mode: offer.mode, direction: 'incoming', members, signal: { from: offer.from, from_username: peerData.username, sdp: offer.sdp, members } });
            } else {
              setCallState({ mode: offer.mode, direction: 'incoming', peer: peerData, signal: { sdp: offer.sdp } });
            }
          })();
        } else if (data.type === 'read') {
          // read receipt from another user
          if (data.conversation_id === activeId) {
            setReads((cur) => {
              const others = cur.filter((r) => r.user_id !== data.user_id);
              return [...others, { user_id: data.user_id, last_read_message_id: data.last_read_message_id }];
            });
          }
        } else if (data.type === 'conversation-created') {
          loadConversations();
        } else if (data.type === 'status-new') {
          window.dispatchEvent(new Event('ssc-status-new'));
        } else if (isContactRealtimeEvent(data)) {
          const full = data.type === 'friend-accepted' || data.type === 'contacts-changed';
          refreshContactsRosterRef.current?.({ full });
          if (data.type === 'friend-request' && data.from_username) {
            toast.message(t('friendRequestIncoming', { user: data.from_username }));
          } else if (data.type === 'friend-accepted' && data.contact_username) {
            toast.success(t('friendRequestAcceptedBy', { user: data.contact_username }));
          }
        } else if (['call-answer', 'ice-candidate', 'call-end', 'call-reject'].includes(data.type)) {
          (async () => {
            let signal = data;
            if (user?.user_id && data.type !== 'call-end' && data.type !== 'call-reject') {
              try {
                signal = await unpackIncomingSignaling(data, {
                  myUserId: user.user_id,
                  peerUserId: data.from,
                });
              } catch {
                return;
              }
            }
            window.dispatchEvent(new CustomEvent('ssc-signal', { detail: signal }));
            if (signal.type === 'call-end' || signal.type === 'call-reject') {
              stopIncomingRingtone();
              setCallState(null);
              setGroupCallState(null);
            }
          })();
        }
      },
    });
    s.connect();
    socketRef.current = s;
    return () => s.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.user_id]);

  // ─── Load messages on active change ───
  useEffect(() => {
    if (!activeId) { setMessages([]); setReads([]); return; }
    (async () => {
      try {
        const { data } = await api.get(`/conversations/${activeId}/messages`);
        const visible = [];
        for (const msg of data) {
          if (msg?.message_type === SKDM_MESSAGE_TYPE) {
            processIncomingSkdmMessage(msg, {
              myUserId: user?.user_id,
              peerUserId: peer?.user_id,
            }).catch(() => {});
          } else if (msg?.message_type === STATUS_SKDM_MESSAGE_TYPE) {
            processIncomingStatusSkdmMessage(msg, {
              myUserId: user?.user_id,
              peerUserId: msg.sender_id !== user?.user_id ? msg.sender_id : peer?.user_id,
            }).catch(() => {});
          } else {
            visible.push(msg);
          }
        }
        setMessages(visible);
        const { data: rs } = await api.get(`/conversations/${activeId}/reads`);
        setReads(rs);
        // mark as read
        try { await api.post('/messages/read', { conversation_id: activeId }); } catch {}
      } catch {}
    })();
  }, [activeId, user?.user_id, peer?.user_id]);

  // Engine 8.4 — establish X3DH session when opening a 1:1 chat (Android native)
  useEffect(() => {
    if (!activeId || isGroup || !peer?.user_id) return;
    ensureSignalSession(peer.user_id, user?.user_id).catch(() => {});
  }, [activeId, isGroup, peer?.user_id, user?.user_id]);

  // Mark new incoming messages as read when the chat is open
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_id !== user?.user_id) {
      api.post('/messages/read', { conversation_id: activeId, up_to_message_id: last.message_id }).catch(() => {});
    }
  }, [messages, activeId, user]);

  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    userNearBottomRef.current = dist < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (userNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, activeId]);

  // ─── Search users ───
  useEffect(() => {
    if (!searchOpen || searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q: searchQ } });
        setSearchResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, searchOpen]);

  const startConversation = async (u) => {
    try {
      const { data } = await api.post('/conversations', { peer_username: u.username });
      await loadConversations();
      goToConversation(data.conversation_id);
      setSearchOpen(false);
      setSearchQ('');
    } catch (e) {
      const detail = e?.response?.data?.detail || '';
      if (detail.includes('contacts') || detail.includes('mutual')) {
        try {
          await api.post('/contacts/request', { username: u.username });
          toast.success(`Friend request sent to @${u.username}`);
          await loadPendingRequests();
          setSearchOpen(false);
          setSearchQ('');
        } catch (reqErr) {
          toast.error(reqErr?.response?.data?.detail || t('couldNotSendRequest'));
        }
      } else {
        toast.error(detail || t('couldNotStartChat'));
      }
    }
  };

  // ─── Send message ───
  const sendMessage = async (text, type = 'text', attachmentId = null, attachmentEnc = null) => {
    if (!activeConv) return;
    if (!text && !attachmentId) return;
    if (!isGroup && peer && isPeerBlocked(peer.user_id, myContacts)) {
      toast.error(t('cannotMessageBlocked'));
      return;
    }
    if (!canMessagePeer) {
      toast.info(isRequestPendingPeer ? t('requestPendingChat') : t('cannotMessageNonMutual'));
      return;
    }
    try {
      const useSignal = await prepareInstalledMessaging({
        isGroup,
        peer,
        user,
        members: activeConv?.members || [],
        refreshUser,
      });

      if (usesSignalOnlyMessaging() && !useSignal) {
        toast.error(t('encryptionNotReady'));
        return;
      }

      if (useSignal && isGroup) {
        await ensureGroupSenderKeysDistributed({
          conversationId: activeId,
          members: activeConv.members || [],
          ourUserId: user.user_id,
        });
        let enc;
        if (attachmentId && attachmentEnc?.signal_meta) {
          const { buildSignalAttachmentEnvelope } = await import('../lib/signal/attachments');
          enc = await encryptGroupText(
            activeId,
            user.user_id,
            buildSignalAttachmentEnvelope(attachmentEnc.signal_meta),
          );
        } else {
          enc = await encryptGroupText(activeId, user.user_id, text || '');
        }
        await api.post('/messages', {
          conversation_id: activeId,
          protocol: ProtocolVersion.SIGNAL_GROUP_V1,
          ciphertext: enc.ciphertext,
          signal_message_type: enc.signal_message_type,
          distribution_id: enc.distribution_id,
          message_type: type,
          attachment_id: attachmentId || undefined,
          attachment_content_type: attachmentEnc?.content_type,
        });
        setDraft('');
        return;
      }

      if (useSignal && !isGroup) {
        let enc;
        if (attachmentId && attachmentEnc?.signal_meta) {
          enc = await encryptSignalAttachment(peer.user_id, user.user_id, attachmentEnc.signal_meta);
        } else {
          enc = await encryptSignalText(peer.user_id, user.user_id, text || '');
        }
        await api.post('/messages', {
          conversation_id: activeId,
          protocol: ProtocolVersion.SIGNAL_V1,
          ciphertext: enc.ciphertext,
          signal_message_type: enc.signal_message_type,
          message_type: type,
          attachment_id: attachmentId || undefined,
          attachment_content_type: attachmentEnc?.content_type,
        });
        setDraft('');
        return;
      }

      if (!privateKey) {
        toast.error(t('encryptionNotReady'));
        return;
      }
      const recipients = recipientsForActive;
      if (Object.keys(recipients).length < 2) {
        toast.error('No recipients have encryption keys yet');
        return;
      }
      const enc = await encryptMessageForRecipients(text || '', recipients);
      await api.post('/messages', {
        conversation_id: activeId,
        protocol: ProtocolVersion.LEGACY_RSA,
        ciphertext: enc.ciphertext, iv: enc.iv, encrypted_keys: enc.encrypted_keys,
        message_type: type, attachment_id: attachmentId,
        attachment_iv: attachmentEnc?.iv,
        attachment_encrypted_keys: attachmentEnc?.encrypted_keys,
        attachment_content_type: attachmentEnc?.content_type,
      });
      setDraft('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to send (encryption error)');
    }
  };

  const uploadEncryptedAttachment = async (blob, filename, mimeType) => {
    const raw = await blob.arrayBuffer();
    const useSignal = await prepareInstalledMessaging({
      isGroup,
      peer,
      user,
      members: activeConv?.members || [],
      refreshUser,
    });
    if (usesSignalOnlyMessaging() && !useSignal) {
      throw new Error('encryption_not_ready');
    }

    let enc;
    if (useSignal) {
      enc = await encryptAttachmentBytes(raw);
    } else {
      const recipients = recipientsForActive;
      if (Object.keys(recipients).length < 2) {
        throw new Error('No recipients have encryption keys yet');
      }
      enc = await encryptBytesForRecipients(raw, recipients);
    }

    const cipherBlob = new Blob([b64ToBytes(enc.ciphertext)], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('file', cipherBlob, `${filename}.enc`);
    form.append('encrypted', 'true');
    if (mimeType) form.append('original_content_type', mimeType);
    const { data } = await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    const contentType = mimeType || 'application/octet-stream';

    if (useSignal) {
      return {
        fileId: data.file_id,
        attachmentEnc: {
          content_type: contentType,
          signal_meta: {
            file_id: data.file_id,
            iv: enc.iv,
            key: enc.key,
            content_type: contentType,
            caption: filename,
          },
        },
      };
    }

    return {
      fileId: data.file_id,
      attachmentEnc: {
        iv: enc.iv,
        encrypted_keys: enc.encrypted_keys,
        content_type: contentType,
      },
    };
  };

  const onSendText = (e) => {
    e?.preventDefault?.();
    if (!draft.trim()) return;
    sendMessage(draft.trim(), 'text');
  };

  // ─── File upload ───
  const fileInputRef = useRef(null);
  const onPickFile = () => fileInputRef.current?.click();

  const attachFile = async (file, { fromPaste = false } = {}) => {
    if (!file || uploadBusy || !activeConv) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t('fileTooLarge'));
      return;
    }
    const canSend = await prepareInstalledMessaging({
      isGroup,
      peer,
      user,
      members: activeConv?.members || [],
      refreshUser,
    });
    if (usesSignalOnlyMessaging() && !canSend) {
      toast.error(t('encryptionNotReady'));
      return;
    }
    if (!usesSignalOnlyMessaging() && !privateKey && !canSend) {
      toast.error(t('encryptionNotReady'));
      return;
    }
    setUploadBusy(true);
    try {
      const type = (file.type || '').startsWith('image/') ? 'image' : 'file';
      const mime = file.type || (type === 'image' ? 'image/png' : 'application/octet-stream');
      const name = file.name || (type === 'image' ? 'screenshot.png' : 'attachment');
      const { fileId, attachmentEnc } = await uploadEncryptedAttachment(file, name, mime);
      await sendMessage(name, type, fileId, attachmentEnc);
      if (fromPaste && type === 'image') {
        toast.success(t('pasteImageAttached'));
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 413) toast.error(t('fileTooLarge'));
      else if (err?.message?.includes('encryption keys')) toast.error(err.message);
      else toast.error(err?.response?.data?.detail || t('uploadFailed'));
    } finally {
      setUploadBusy(false);
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await attachFile(file);
  };

  const onComposerPaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type?.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await attachFile(file, { fromPaste: true });
        return;
      }
    }
  };

  // ─── Calls ───
  const startCall = async (mode) => {
    if (!isGroup && peer && isPeerBlocked(peer.user_id, myContacts)) {
      toast.error(t('cannotMessageBlocked'));
      return;
    }
    const ok = await ensureMediaPermissions(
      { audio: true, video: mode === 'video' },
      { t },
    );
    if (!ok) return;

    if (isGroup && activeConv) {
      const members = (activeConv.members || []).filter((m) => m.user_id !== user?.user_id);
      if (members.length === 0) { toast.error('No members in this group'); return; }
      const { validateGroupCallSize } = await import('../lib/groupCalls');
      const capErr = await validateGroupCallSize(members.length);
      if (capErr) { toast.error(capErr); return; }
      setGroupCallState({ mode, direction: 'outgoing', members, signal: null });
      return;
    }
    if (!peer) return;
    setCallState({ mode, direction: 'outgoing', peer, signal: null });
  };

  const acceptCall = async () => {
    if (!callState) return;
    const ok = await ensureMediaPermissions(
      { audio: true, video: callState.mode === 'video' },
      { t },
    );
    if (!ok) return;
    stopIncomingRingtone();
    setCallState((s) => s ? { ...s, direction: 'incoming-accepted' } : s);
  };
  const rejectCall = () => {
    if (!callState) return;
    stopIncomingRingtone();
    socketRef.current?.send({ type: 'call-reject', to: callState.peer.user_id });
    setCallState(null);
  };
  const rejectGroupCall = () => {
    if (!groupCallState) return;
    stopIncomingRingtone();
    const from = groupCallState.signal?.from;
    if (from) {
      socketRef.current?.send({ type: 'call-reject', to: from, group: true });
    }
    setGroupCallState(null);
  };

  const acceptGroupCall = async () => {
    if (!groupCallState) return;
    const ok = await ensureMediaPermissions(
      { audio: true, video: groupCallState.mode === 'video' },
      { t },
    );
    if (!ok) return;
    stopIncomingRingtone();
    setGroupCallState((s) => s ? { ...s, direction: 'incoming-accepted' } : s);
  };

  // ─── Typing ───
  const onDraftChange = (v) => {
    setDraft(v);
    if (activeId && socketRef.current) {
      socketRef.current.send({ type: 'typing', conversation_id: activeId });
    }
  };

  const startRecording = async () => {
    if (voiceRecordingRef.current) return;
    const ok = await ensureMediaPermissions({ audio: true, video: false }, { t });
    if (!ok) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const session = startVoiceRecording(stream);
      voiceRecordingRef.current = session;
      setIsRecording(true);
      setTimeout(() => { if (voiceRecordingRef.current === session) stopRecording(); }, 30000);
    } catch (e) {
      toast.error(t('micPermissionDenied'));
    }
  };

  const stopRecording = async () => {
    const session = voiceRecordingRef.current;
    if (!session) return;
    voiceRecordingRef.current = null;
    session.stop();
    setIsRecording(false);
    try {
      const { blob, mimeType } = await session.done;
      if (blob.size < MIN_VOICE_BLOB_BYTES) {
        toast.error(t('voiceNoteTooShort'));
        return;
      }
      const canSend = await prepareInstalledMessaging({
        isGroup,
        peer,
        user,
        members: activeConv?.members || [],
        refreshUser,
      });
      if (usesSignalOnlyMessaging() && !canSend) {
        toast.error(t('encryptionNotReady'));
        return;
      }
      if (!usesSignalOnlyMessaging() && !privateKey && !canSend) {
        toast.error(t('encryptionNotReady'));
        return;
      }
      setUploadBusy(true);
      try {
        const filename = voiceFilenameForMime(mimeType);
        const { fileId, attachmentEnc } = await uploadEncryptedAttachment(blob, filename, mimeType);
        await sendMessage('', 'voice', fileId, attachmentEnc);
      } catch (e) {
        toast.error(t('voiceNoteFailed'));
      } finally {
        setUploadBusy(false);
      }
    } catch (e) {
      toast.error(t('voiceNoteFailed'));
    }
  };

  return (
    <div className="mobile-shell flex bg-[#0A0A0A] text-[#F0F0F0] overflow-hidden">
      {/* Sidebar / chat list */}
      <aside className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 lg:w-96 md:border-r border-[#27272A] shrink-0 min-h-0`}>
        <div className="glass-header safe-top safe-x px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2" data-testid="sidebar-logo">
            <Avatar user={user} size="xs" />
            <div>
              <div className="font-mono text-xs tracking-[0.25em]">SSC</div>
              <div className="text-[10px] font-mono text-[#A1A1AA]">@{user?.username}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSettingsOpen(true)} title={t('settings')} data-testid="open-settings-button"
              className="w-9 h-9 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center">
              <Gear size={16} />
            </button>
            <PanicButton onWipe={panicWipe} />
            <button onClick={logout} title={t('logout')} data-testid="logout-button" className="w-9 h-9 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center">
              <SignOut size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-[#27272A] flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={() => setSearchOpen(true)} data-testid="new-chat-button"
              className="flex-1 h-10 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center gap-2 px-3 text-sm text-[#A1A1AA]">
              <Plus size={16} /> {t('newChat')}
            </button>
            <button onClick={() => setGroupOpen(true)} title={t('createGroup')} data-testid="new-group-button"
              className="w-10 h-10 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center">
              <UsersThree size={16} />
            </button>
          </div>
          <button onClick={() => setContactsOpen(true)} data-testid="open-contacts-button"
            className="h-9 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center gap-2 text-[10px] font-mono tracking-widest text-[#A1A1AA]">
            <UsersThree size={14} /> {t('contacts')}
            {pendingRequests.length > 0 && (
              <span className="bg-[#FFD600] text-black px-1.5 rounded text-[9px]">{pendingRequests.length}</span>
            )}
          </button>
        </div>

        {/* Stories bar */}
        <StoriesBar me={user} privateKey={privateKey} onView={(g) => setStoryGroup(g)} />

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-xs font-mono text-[#A1A1AA] tracking-wider">
              {t('noConversations')}
              <p className="mt-2 normal-case font-sans tracking-normal">{t('noConversationsHint')}</p>
            </div>
          )}
          {sidebarConversations.map((c) => {
            const peerMuted = !c.is_group && isPeerMuted(c.peer?.user_id, myContacts);
            return (
              <ConversationListRow
                key={c.conversation_id}
                conversation={c}
                activeId={activeId}
                onSelect={goToConversation}
                onOpenActions={setConvActionsTarget}
              >
                <Avatar
                  user={c.is_group ? null : c.peer}
                  isGroup={c.is_group}
                  size="md"
                  showOnline={!c.is_group}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {c.is_group ? (formatGroupConversationLabel(c) || t('group')) : `@${c.peer?.username}`}
                      {peerMuted && <span className="text-[#A1A1AA] font-mono text-[10px] ml-1">· {t('muted')}</span>}
                    </span>
                    <span className="text-[10px] font-mono text-[#A1A1AA]">
                      {c.is_group ? `${c.participants.length}P` : c.peer?.language?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] truncate font-mono">
                    {c.last_activity?.has_messages ? `· ${t('encryptedMessage')} ·` : t('noMessagesYet')}
                  </div>
                </div>
              </ConversationListRow>
            );
          })}
        </div>
      </aside>

      {/* Chat panel */}
      <main className={`${showChatPanel ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0 min-w-0 w-full`}>
        {!activeConv ? (
          <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center px-6 relative">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{ backgroundImage: 'linear-gradient(rgba(0,229,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />
            <ShieldCheck size={48} weight="duotone" className="text-[#00E5FF] mb-4 relative" />
            <h2 className="font-mono text-2xl tracking-tighter relative">{t('selectChat')}</h2>
            <p className="text-sm text-[#A1A1AA] mt-2 relative">{t('selectChatHint')}</p>
          </div>
        ) : (
          <>
            <header className="glass-header safe-x px-2 md:px-4 py-2 md:py-3 flex items-center gap-2 shrink-0 relative z-[70]">
              {isMobile && (
                <button
                  type="button"
                  onClick={leaveChat}
                  className="w-10 h-10 rounded-md tac-border bg-[#121212] active:bg-[#1A1A1A] flex items-center justify-center shrink-0"
                  data-testid="chat-back-button"
                  aria-label={t('back')}
                >
                  <CaretLeft size={20} weight="bold" />
                </button>
              )}
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <Avatar user={isGroup ? null : peer} isGroup={isGroup} size="sm" showOnline={!isGroup} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" data-testid="chat-peer-username">
                    {headerTitle}
                  </div>
                  <div className="text-[10px] font-mono tracking-wider truncate flex items-center gap-1 text-[#A1A1AA]">
                    <span className="truncate" data-testid="chat-peer-status">
                      {isGroup
                        ? `${activeConv.participants.length} ${t('members')}`
                        : `${formatPeerPresence(peer)} · ${peer?.language?.toUpperCase() || '—'}`}
                    </span>
                    <span className="text-[#34C759]" data-testid="chat-retention-badge">
                      · {t('retentionBadge', { hours: String(retentionHours) })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                {isMobile ? (
                  <>
                    {!isGroup && peer && (
                      <MobileChatMenu
                        open={chatMenuOpen}
                        onToggle={() => setChatMenuOpen((v) => !v)}
                        onClose={() => setChatMenuOpen(false)}
                      >
                        {showTranslateControls && (
                          <MenuAction
                            testId="mobile-toggle-autotranslate"
                            onClick={() => {
                              setChatMenuOpen(false);
                              setAutoTranslate((v) => {
                                if (!v) {
                                  toast.info(translationOnDevice ? t('autoTranslateOnDevice') : t('autoTranslateWarning'));
                                }
                                return !v;
                              });
                            }}
                          >
                            {t('autoTr')} {autoTranslate ? t('on') : t('off')}
                          </MenuAction>
                        )}
                        <MenuAction
                          testId="mobile-search-messages"
                          onClick={() => {
                            setChatMenuOpen(false);
                            setMobileMsgSearchOpen((v) => !v);
                          }}
                        >
                          {t('searchMessages')}
                        </MenuAction>
                        <MenuAction
                          testId="mobile-block"
                          onClick={() => { setChatMenuOpen(false); toggleBlock(peer.user_id); }}
                        >
                          {peerContact?.blocked ? t('unblock') : t('block')}
                        </MenuAction>
                        <MenuAction
                          testId="mobile-mute"
                          onClick={() => { setChatMenuOpen(false); toggleMute(peer.user_id); }}
                        >
                          {peerContact?.muted ? t('unmute') : t('mute')}
                        </MenuAction>
                        <MenuAction
                          testId="mobile-delete-contact"
                          danger
                          onClick={() => { setChatMenuOpen(false); removeContact(peer.user_id); }}
                        >
                          {t('deleteContact')}
                        </MenuAction>
                      </MobileChatMenu>
                    )}
                    <button onClick={() => startCall('audio')} data-testid="start-voice-call" className="w-10 h-10 rounded-md tac-border bg-[#121212] active:bg-[#1A1A1A] flex items-center justify-center" title={t('voiceCall')}>
                      <Phone size={18} />
                    </button>
                    <button onClick={() => startCall('video')} data-testid="start-video-call" className="w-10 h-10 rounded-md tac-border bg-[#121212] active:bg-[#1A1A1A] flex items-center justify-center" title={t('videoCall')}>
                      <VideoCamera size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    {!isGroup && peer && (
                      <>
                        <button onClick={() => toggleBlock(peer.user_id)} className="text-[10px] px-2 py-1 tac-border rounded" data-testid="block-button">
                          {peerContact?.blocked ? t('unblock').toUpperCase() : t('block').toUpperCase()}
                        </button>
                        <button onClick={() => toggleMute(peer.user_id)} className="text-[10px] px-2 py-1 tac-border rounded" data-testid="mute-button">
                          {peerContact?.muted ? t('unmute').toUpperCase() : t('mute').toUpperCase()}
                        </button>
                        <button onClick={() => removeContact(peer.user_id)} className="text-[10px] px-2 py-1 tac-border rounded text-[#FF3B30]" data-testid="delete-contact-button">
                          {t('deleteLabel')}
                        </button>
                      </>
                    )}
                    {showTranslateControls && (
                      <button onClick={() => {
                        setAutoTranslate((v) => {
                          if (!v) {
                            toast.info(translationOnDevice ? t('autoTranslateOnDevice') : t('autoTranslateWarning'));
                          }
                          return !v;
                        });
                      }} data-testid="toggle-autotranslate"
                        className={`h-9 px-3 rounded-md tac-border flex items-center gap-2 text-xs font-mono tracking-widest ${autoTranslate ? 'bg-[#FFD600] text-black' : 'bg-[#121212] hover:bg-[#1A1A1A]'}`}>
                        <Translate size={14} /> {t('autoTr')} {autoTranslate ? t('on') : t('off')}
                      </button>
                    )}
                    <button onClick={() => startCall('audio')} data-testid="start-voice-call" className="w-9 h-9 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center" title={t('voiceCall')}>
                      <Phone size={16} />
                    </button>
                    <button onClick={() => startCall('video')} data-testid="start-video-call" className="w-9 h-9 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center" title={t('videoCall')}>
                      <VideoCamera size={16} />
                    </button>
                  </>
                )}
              </div>
            </header>

            {(isMobile && mobileMsgSearchOpen) && (
              <div className="md:hidden px-3 py-2 border-b border-[#27272A] shrink-0">
                <input
                  value={messageFilter}
                  onChange={(e) => setMessageFilter(e.target.value)}
                  placeholder={t('searchMessages')}
                  className="w-full text-sm px-3 py-2 bg-[#1A1A1A] border border-[#27272A] rounded-md"
                  data-testid="mobile-message-filter"
                  autoFocus
                />
              </div>
            )}

            <div ref={scrollRef} onScroll={onMessagesScroll} className="chat-scroll px-3 md:px-6 py-3 flex flex-col gap-3">
              <div className="hidden md:block px-3 py-1">
                <input value={messageFilter} onChange={(e) => setMessageFilter(e.target.value)} placeholder={t('searchMessages')} className="w-full text-xs bg-transparent border-0 border-b border-[#27272A] pb-1" data-testid="message-filter" />
              </div>
              {messages.length === 0 && (
                <div className="text-center text-xs font-mono text-[#A1A1AA] tracking-wider my-8">
                  {t('emptyChatHint')}
                </div>
              )}
              {filteredMessages.map((m) => (
                <Message
                  key={m.message_id}
                  msg={m}
                  isMine={m.sender_id === user?.user_id}
                  myUserId={user?.user_id}
                  peerUserId={peer?.user_id}
                  privateKey={privateKey}
                  autoTranslate={translationEnabled && autoTranslate && !sameLangAsPeer}
                  translationEnabled={translationEnabled}
                  translationOnDevice={translationOnDevice}
                  serverTranslationAllowed={serverTranslationAllowed}
                  targetLang={user?.language || 'en'}
                  sourceLang={peer?.language}
                  reads={reads}
                  participantsCount={activeConv?.participants?.length || 2}
                />
              ))}
              {typingFrom && (
                <div className="text-[11px] font-mono text-[#A1A1AA] tracking-wider self-start" data-testid="typing-indicator">
                  {t('typingUser', { user: typingFrom })}
                </div>
              )}
            </div>

            {!canMessagePeer && !isGroup && (
              <div className="px-3 py-2 border-t border-[#27272A] text-[11px] text-[#FFD600] bg-[#FFD600]/10">
                {isRequestPendingPeer ? t('requestPendingChat') : t('cannotMessageNonMutual')}
              </div>
            )}
            <form onSubmit={onSendText} className="chat-composer safe-bottom safe-x border-t border-[#27272A] px-2 md:px-3 py-2 flex items-center gap-2">
              <input ref={fileInputRef} type="file" hidden onChange={onFileChange} data-testid="file-input" />
              <button type="button" onClick={onPickFile} disabled={uploadBusy || !canMessagePeer} data-testid="attach-button"
                className="w-11 h-11 rounded-md tac-border bg-[#121212] active:bg-[#1A1A1A] flex items-center justify-center shrink-0 disabled:opacity-40"
                title={uploadBusy ? t('uploadInProgress') : undefined}>
                <Paperclip size={18} />
              </button>
              <button type="button" onClick={isRecording ? stopRecording : startRecording} data-testid="voice-button" disabled={!canMessagePeer}
                className={`w-11 h-11 rounded-md tac-border flex items-center justify-center shrink-0 ${isRecording ? 'bg-[#FF3B30] text-white' : 'bg-[#121212] active:bg-[#1A1A1A]'}`}>
                <Microphone size={18} />
              </button>
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onPaste={onComposerPaste}
                data-testid="message-input"
                placeholder={t('messagePlaceholder')}
                className="flex-1 min-w-0 h-11 px-3 text-base rounded-md"
                enterKeyHint="send"
                autoComplete="off"
                disabled={!canMessagePeer}
              />
              <button
                type="submit"
                data-testid="send-button"
                className="h-11 min-w-[44px] px-3 md:px-4 bg-[#00E5FF] text-black rounded-md font-medium text-sm flex items-center justify-center gap-2 active:brightness-90 transition disabled:opacity-40 shrink-0"
                disabled={!draft.trim() || !canMessagePeer}
                aria-label={t('send')}
              >
                <PaperPlaneTilt size={18} weight="fill" />
                <span className="send-label hidden sm:inline">{t('send').toUpperCase()}</span>
              </button>
            </form>
          </>
        )}
      </main>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xl flex items-start justify-center pt-24 px-4" onClick={() => setSearchOpen(false)}>
          <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs tracking-[0.25em]">{t('newChatTitle')}</h3>
              <button onClick={() => setSearchOpen(false)} className="text-[#A1A1AA] hover:text-white" data-testid="close-search"><X size={16} /></button>
            </div>
            <p className="text-[11px] text-[#A1A1AA] mb-3 normal-case tracking-normal">
              {t('newChatHint')}
            </p>
            <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border">
              <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder={t('searchUsername')}
                data-testid="search-input" className="bg-transparent flex-1 outline-none border-0 text-sm" autoFocus />
            </div>
            <div className="mt-3 max-h-80 overflow-y-auto">
              {searchQ.length < 2 && (
                <>
                  {acceptedContacts.length > 0 && (
                    <div className="mb-3">
                      <div className="px-1 pb-2 text-[10px] font-mono tracking-wider text-[#A1A1AA] uppercase">
                        {t('contacts')}
                      </div>
                      {acceptedContacts.map((c) => (
                        <button
                          key={c.user_id}
                          onClick={() => startConversation(c)}
                          data-testid={`contact-picker-${c.username}`}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3"
                        >
                          <Avatar user={c} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">@{c.username}</div>
                            <div className="text-[10px] font-mono text-[#A1A1AA]">{t('tapToMessage')}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="px-3 py-4 text-center text-[11px] font-mono text-[#A1A1AA] tracking-wider">{t('type2chars')}</div>
                </>
              )}
              {searchResults.map((u) => {
                const isContact = myContacts.some(c => c.user_id === u.user_id && !c.blocked);
                const isMuted = myContacts.some(c => c.user_id === u.user_id && c.muted);
                const requestSent = outgoingRequests.some((r) => r.to_user_id === u.user_id);
                return (
                  <button key={u.user_id} onClick={() => startConversation(u)} data-testid={`search-result-${u.username}`}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3">
                    <Avatar user={u} size="sm" />
                    <div className="flex-1">
                      <div className="text-sm">@{u.username} {isContact && '✓'} {isMuted && `(${t('muted')})`}</div>
                      <div className="text-[10px] font-mono text-[#A1A1AA]">
                        {isContact ? t('tapToMessage') : requestSent ? t('requestSentLabel') : t('tapToAdd')}
                      </div>
                    </div>
                  </button>
                );
              })}
              {searchQ.length >= 2 && searchResults.length === 0 && (
                <div className="px-3 py-6 text-center text-[11px] font-mono text-[#A1A1AA] tracking-wider">{t('noUsersFound')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incoming call ring */}
      {callState && callState.direction === 'incoming' && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center safe-top safe-bottom pointer-events-auto"
          data-testid="incoming-call-overlay"
        >
          <div className="text-center px-6">
            <div className="mx-auto mb-4">
              <Avatar user={callState.peer} size="xl" />
            </div>
            <div className="font-mono text-lg">@{callState.peer.username}</div>
            <div className="text-xs font-mono text-[#A1A1AA] tracking-widest mt-1">{callState.mode === 'video' ? t('incomingVideoCall') : t('incomingAudioCall')}</div>
            <div className="mt-8 flex items-center justify-center gap-4">
              <button onClick={rejectCall} data-testid="call-reject-button" className="w-14 h-14 rounded-full bg-[#FF3B30] flex items-center justify-center hover:brightness-110">
                <Phone size={22} weight="fill" className="rotate-[135deg]" />
              </button>
              <button onClick={acceptCall} data-testid="call-accept-button" className="w-14 h-14 rounded-full bg-[#34C759] flex items-center justify-center hover:brightness-110">
                <Phone size={22} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call */}
      {callState && callState.direction !== 'incoming' && (
        <CallModal mode={callState.mode} direction={callState.direction === 'incoming-accepted' ? 'incoming' : 'outgoing'}
          peer={callState.peer} user={user} socket={socketRef.current} signal={callState.signal}
          onClose={() => setCallState(null)} />
      )}

      <ContactsModal
        open={contactsOpen}
        onClose={() => setContactsOpen(false)}
        contacts={myContacts}
        pendingRequests={pendingRequests}
        outgoingRequests={outgoingRequests}
        onAddUser={sendFriendRequest}
        onAccept={acceptRequest}
        onReject={rejectRequest}
        onMessage={async (c) => {
          try {
            const { data } = await api.post('/conversations', { peer_username: c.username });
            await loadConversations();
            goToConversation(data.conversation_id);
            setContactsOpen(false);
          } catch (e) {
            toast.error(e?.response?.data?.detail || t('couldNotOpenChat'));
          }
        }}
        onToggleBlock={toggleBlock}
        onToggleMute={toggleMute}
        onRemove={removeContact}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ConfirmDialog
        open={!!confirmRemoveUid}
        title={t('deleteContact')}
        message={t('deleteContactConfirm')}
        danger
        onConfirm={confirmRemoveContact}
        onCancel={() => setConfirmRemoveUid(null)}
        testId="confirm-remove-contact"
      />
      <OnboardingCoach
        open={onboardingOpen}
        userId={user?.user_id}
        onComplete={() => setOnboardingOpen(false)}
      />
      <CreateGroupModal
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        myUserId={user?.user_id}
        contacts={myContacts}
        onCreated={(c) => { loadConversations(); goToConversation(c.conversation_id); }}
      />

      <ConversationActionsSheet
        open={!!convActionsTarget}
        conversation={convActionsTarget}
        contact={convActionsTarget && !convActionsTarget.is_group
          ? myContacts.find((x) => x.user_id === convActionsTarget.peer?.user_id)
          : null}
        onClose={() => setConvActionsTarget(null)}
        onMute={toggleMute}
        onBlock={toggleBlock}
        onDelete={deleteConversation}
      />

      {storyGroup && (
        <StoryViewer
          group={storyGroup}
          me={user}
          privateKey={privateKey}
          onDeleted={storyGroup.onDeleted}
          onClose={() => setStoryGroup(null)}
        />
      )}
      {groupCallState && groupCallState.direction === 'incoming' && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center safe-top safe-bottom pointer-events-auto"
          data-testid="incoming-group-call-overlay"
        >
          <div className="text-center px-6">
            <div className="w-24 h-24 rounded-md bg-[#1E2A38] mx-auto flex items-center justify-center mb-4">
              <UsersThree size={28} className="text-[#00E5FF]" weight="duotone" />
            </div>
            <div className="font-mono text-lg">{t('groupCall')}</div>
            <div className="text-xs font-mono text-[#A1A1AA] tracking-widest mt-1">
              {t('groupCallIncoming', { mode: groupCallState.mode.toUpperCase(), count: String(groupCallState.members.length + 1) })}
            </div>
            <div className="mt-8 flex items-center justify-center gap-4">
              <button onClick={rejectGroupCall} data-testid="group-call-reject" className="w-14 h-14 rounded-full bg-[#FF3B30] flex items-center justify-center hover:brightness-110">
                <Phone size={22} weight="fill" className="rotate-[135deg]" />
              </button>
              <button onClick={acceptGroupCall} data-testid="group-call-accept" className="w-14 h-14 rounded-full bg-[#34C759] flex items-center justify-center hover:brightness-110">
                <Phone size={22} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      )}
      {groupCallState && groupCallState.direction !== 'incoming' && (
        <GroupCallModal mode={groupCallState.mode}
          direction={groupCallState.direction === 'incoming-accepted' ? 'incoming' : 'outgoing'}
          members={groupCallState.members} me={user} user={user}
          conversationId={activeId} socket={socketRef.current} signal={groupCallState.signal}
          onClose={() => setGroupCallState(null)} />
      )}
    </div>
  );
}
