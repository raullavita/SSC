import { useCallback, useEffect, useState } from 'react';
import { api, wsAuthPayload, wsUrl } from '../lib/api';
import { indexReadsByMessage } from '../lib/readReceipts';

function applyReadReceipt(setReadByMessage, payload) {
  if (payload?.type === 'read_receipt' && payload.message_id) {
    setReadByMessage((prev) => {
      const existing = prev[payload.message_id] || [];
      if (existing.includes(payload.read_at)) return prev;
      return {
        ...prev,
        [payload.message_id]: [...existing, payload.read_at],
      };
    });
  }
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

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    const topics = [`user:${userId}`];
    if (conversationId) topics.push(`conversation:${conversationId}`);

    const ws = new WebSocket(wsUrl());

    ws.onopen = () => {
      const auth = wsAuthPayload(wsToken);
      if (auth) ws.send(auth);
      for (const topic of topics) {
        ws.send(JSON.stringify({ type: 'subscribe', topic }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const payload = data?.payload || data;
        applyReadReceipt(setReadByMessage, payload);
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
    };
  }, [conversationId, enabled, userId, wsToken]);

  return { readByMessage, markRead };
}