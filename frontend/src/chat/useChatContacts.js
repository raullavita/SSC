import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { subscribeContactsRefresh } from '../lib/contactRealtime';
import { visibleConversations } from '../lib/contactFilters';
import { syncConversationChannelMute, ensureConversationNotificationChannel } from '../lib/nativeNotificationChannels';
import { partitionSidebarConversations, sortArchivedConversations } from '../lib/chatArchives';
import { sortSidebarConversations } from '../lib/chatPins';

export function useChatContacts({
  user,
  t,
  activeId,
  leaveChat,
  confirmRemoveUid,
  setConfirmRemoveUid,
}) {
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [myContacts, setMyContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  const refreshContactsRosterRef = useRef(null);
  const conversationsRef = useRef(conversations);
  const myContactsRef = useRef(myContacts);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    myContactsRef.current = myContacts;
  }, [myContacts]);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data);
    } catch {
      /* ignore */
    } finally {
      setConversationsLoading(false);
    }
  }, []);

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

  const visibleConvs = useMemo(
    () => visibleConversations(conversations, myContacts),
    [conversations, myContacts],
  );

  const sidebarConversations = useMemo(() => {
    const { active } = partitionSidebarConversations(visibleConvs);
    return sortSidebarConversations(active);
  }, [visibleConvs]);

  const archivedConversations = useMemo(() => {
    const { archived } = partitionSidebarConversations(visibleConvs);
    return sortArchivedConversations(archived);
  }, [visibleConvs]);

  const activeConv = useMemo(
    () => sidebarConversations.find((c) => c.conversation_id === activeId)
      || conversations.find((c) => c.conversation_id === activeId),
    [sidebarConversations, conversations, activeId],
  );
  const peer = activeConv?.peer;
  const isGroup = !!activeConv?.is_group;

  const acceptedContacts = useMemo(
    () => myContacts
      .filter((c) => !c.blocked)
      .sort((a, b) => (a.username || '').localeCompare(b.username || '')),
    [myContacts],
  );

  const sendFriendRequest = async (u) => {
    await api.post('/contacts/request', { username: u.username });
    toast.success(t('friendRequestSent', { user: u.username }));
    await loadPendingRequests();
  };

  const acceptRequest = async (reqId) => {
    try {
      await api.post('/contacts/requests/accept', { request_id: reqId });
      toast.success(t('friendRequestAccepted'));
      await loadPendingRequests();
      await loadMyContacts();
      await loadConversations();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('requestActionFailed'));
    }
  };

  const rejectRequest = async (reqId) => {
    try {
      await api.post('/contacts/requests/reject', { request_id: reqId });
      toast.success(t('friendRequestRejected'));
      await loadPendingRequests();
    } catch (e) {
      toast.error(t('requestActionFailed'));
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

  const resolveDmConversationId = useCallback((uid) => {
    const conv = conversationsRef.current.find((c) => !c.is_group && c.peer?.user_id === uid);
    return conv?.conversation_id || null;
  }, []);

  const muteConversation = async (conversationId, duration = 'forever') => {
    if (!conversationId) return;
    try {
      await api.post(`/conversations/${conversationId}/mute`, { duration });
      await loadConversations();
      await loadMyContacts();
      await syncConversationChannelMute(conversationId, true);
      toast.success(t('contactMuted'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateContact'));
    }
  };

  const unmuteConversation = async (conversationId) => {
    if (!conversationId) return;
    try {
      await api.post(`/conversations/${conversationId}/unmute`);
      await loadConversations();
      await loadMyContacts();
      await syncConversationChannelMute(conversationId, false);
      toast.success(t('contactUnmuted'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateContact'));
    }
  };

  const toggleMute = async (uid) => {
    const conversationId = resolveDmConversationId(uid);
    const conv = conversationsRef.current.find((c) => c.conversation_id === conversationId);
    if (conv?.muted) {
      await unmuteConversation(conversationId);
      return;
    }
    if (conversationId) {
      await muteConversation(conversationId, 'forever');
      return;
    }
    const c = myContacts.find((x) => x.user_id === uid);
    if (!c) return;
    try {
      await api.post(`/contacts/${uid}/mute`, { duration: 'forever' });
      await loadMyContacts();
      toast.success(t('contactMuted'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateContact'));
    }
  };

  const prepareConversationChannel = useCallback(async (conversationId) => {
    await ensureConversationNotificationChannel(conversationId);
  }, []);

  const removeContact = (uid) => {
    setConfirmRemoveUid(uid);
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

  const toggleArchive = async (conv) => {
    if (!conv?.conversation_id) return;
    const wasArchived = conv.archived;
    try {
      if (wasArchived) {
        await api.delete(`/conversations/${conv.conversation_id}/archive`);
      } else {
        await api.post(`/conversations/${conv.conversation_id}/archive`);
      }
      await loadConversations();
      if (!wasArchived && activeId === conv.conversation_id) leaveChat();
      toast.success(wasArchived ? t('chatUnarchived') : t('chatArchived'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateChat'));
    }
  };

  const togglePin = async (conv) => {
    if (!conv?.conversation_id) return;
    const wasPinned = conv.pinned;
    try {
      if (wasPinned) {
        await api.delete(`/conversations/${conv.conversation_id}/pin`);
      } else {
        await api.post(`/conversations/${conv.conversation_id}/pin`);
      }
      await loadConversations();
      toast.success(wasPinned ? t('chatUnpinned') : t('chatPinned'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotUpdateChat'));
    }
  };

  const deleteConversation = async (conv) => {
    if (!conv?.conversation_id) return;
    try {
      if (conv.is_group) {
        await api.delete(`/conversations/${conv.conversation_id}/members/${user?.user_id}`);
      } else {
        await api.delete(`/conversations/${conv.conversation_id}`);
      }
      await loadConversations();
      if (activeId === conv.conversation_id) leaveChat();
      toast.success(conv.is_group ? t('leftGroup') : t('chatDeleted'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotDeleteChat'));
    }
  };

  const refreshActiveGroup = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    setConversations,
    conversationsLoading,
    myContacts,
    pendingRequests,
    outgoingRequests,
    conversationsRef,
    myContactsRef,
    refreshContactsRosterRef,
    loadConversations,
    sidebarConversations,
    archivedConversations,
    activeConv,
    peer,
    isGroup,
    acceptedContacts,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    toggleBlock,
    toggleMute,
    muteConversation,
    unmuteConversation,
    prepareConversationChannel,
    togglePin,
    toggleArchive,
    removeContact,
    confirmRemoveContact,
    deleteConversation,
    refreshActiveGroup,
  };
}