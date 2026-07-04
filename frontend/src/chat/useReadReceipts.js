import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useChatSocket } from './useChatSocket';

export function useReadReceipts(conversationId, messages, { wsToken, userId, enabled }) {
  const [readByMessage, setReadByMessage] = useState({});

  const markRead = useCallback(async () => {
    if (!conversationId || !enabled || !messages.length) return;
    const last = messages[messages.length - 1];
    if (!last?.id || last.sender_id === userId) return;
    try {
      await api.post(`/api/conversations/${conversationId}/read`, {
        last_message_id: last.id,
      });
    } catch {
      /* offline */
    }
  }, [conversationId, enabled, messages, userId]);

  useEffect(() => {
    if (enabled && conversationId && messages.length) {
      markRead();
    }
  }, [conversationId, enabled, messages.length, markRead]);

  useChatSocket({
    enabled: Boolean(conversationId && enabled && wsToken),
    topic: conversationId ? `conversation:${conversationId}` : null,
    wsToken,
    onEvent: (data) => {
      const payload = data?.payload || data;
      if (payload?.type === 'read_receipt' && payload.message_id) {
        setReadByMessage((prev) => ({
          ...prev,
          [payload.message_id]: payload.read_at,
        }));
      }
    },
  });

  return { readByMessage, markRead };
}