import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSyncSocket } from '../hooks/useSyncSocket';
import { indexReadsByMessage } from '../lib/readReceipts';

function applyReadReceipt(setReadByMessage, payload) {
  if (payload?.type !== 'read_receipt' || !payload.message_id) return;

  const readerId = payload.reader_id || null;
  const readAt = payload.read_at;
  if (!readAt && !readerId) return;

  setReadByMessage((prev) => {
    const existing = prev[payload.message_id] || [];
    if (readerId) {
      const duplicate = existing.find(
        (row) => row.readerId === readerId && row.readAt === readAt
      );
      if (duplicate) return prev;
      const filtered = existing.filter((row) => row.readerId !== readerId);
      return {
        ...prev,
        [payload.message_id]: [...filtered, { readerId, readAt }],
      };
    }

    if (existing.some((row) => row.readAt === readAt && !row.readerId)) return prev;
    return {
      ...prev,
      [payload.message_id]: [...existing, { readerId: null, readAt }],
    };
  });
}

export function useReadReceipts(conversationId, messages, { wsToken, userId, enabled }) {
  const [readByMessage, setReadByMessage] = useState({});

  useEffect(() => {
    setReadByMessage({});
    if (!conversationId || !enabled) return undefined;

    let cancelled = false;
    api
      .get(`/api/conversations/${conversationId}/reads`)
      .then((data) => {
        if (cancelled) return;
        setReadByMessage(indexReadsByMessage(data.reads));
      })
      .catch(() => {
        /* offline */
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, enabled]);

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

  const topics = [];
  if (enabled && userId) {
    topics.push(`user:${userId}`);
    if (conversationId) topics.push(`conversation:${conversationId}`);
  }

  useSyncSocket({
    userId: enabled && userId ? userId : null,
    wsToken,
    topics,
    enabled: Boolean(enabled && userId),
    onEvent: (envelope) => applyReadReceipt(setReadByMessage, envelope.payload),
  });

  return { readByMessage, markRead };
}