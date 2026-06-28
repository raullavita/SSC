import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { SKDM_MESSAGE_TYPE } from '../lib/signal/constants';
import { STATUS_SKDM_MESSAGE_TYPE, processIncomingStatusSkdmMessage } from '../lib/signal/statuses';
import { decryptMessageBody } from '../lib/signal/migration';
import { processIncomingSkdmMessage } from '../lib/signal/groupMessages';
import { readReceiptsEnabled } from '../lib/privacySettings';
import { isMessageDeleted } from '../lib/messageDelete';

export function useChatMessages({
  activeId,
  user,
  peer,
  privateKey,
  isGroup,
  activeConv,
}) {
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [reads, setReads] = useState([]);
  const [decryptedBodies, setDecryptedBodies] = useState({});
  const [messageFilter, setMessageFilter] = useState('');
  const userNearBottomRef = useRef(true);

  useEffect(() => {
    if (!user?.user_id || messages.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const m of messages) {
        if (isMessageDeleted(m)) continue;
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

  useEffect(() => {
    if (!activeId) {
      setMessageFilter('');
      setMessages([]);
      setReads([]);
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);
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
        if (readReceiptsEnabled(user)) {
          try { await api.post('/messages/read', { conversation_id: activeId }); } catch {}
        }
      } catch {}
      finally { setMessagesLoading(false); }
    })();
  }, [activeId, user?.user_id, peer?.user_id]);

  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_id !== user?.user_id && readReceiptsEnabled(user)) {
      api.post('/messages/read', { conversation_id: activeId, up_to_message_id: last.message_id }).catch(() => {});
    }
  }, [messages, activeId, user]);

  const onMessagesScroll = (scrollRef) => {
    const el = scrollRef?.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    userNearBottomRef.current = dist < 80;
  };

  return {
    messages,
    setMessages,
    messagesLoading,
    reads,
    setReads,
    decryptedBodies,
    messageFilter,
    setMessageFilter,
    filteredMessages,
    userNearBottomRef,
    onMessagesScroll,
  };
}