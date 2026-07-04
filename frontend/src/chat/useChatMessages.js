import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { indexMessage, indexMessages } from '../search/messageIndex';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { useChatSocket } from './useChatSocket';

export function useChatMessages(conversationId, enabled, peerId, { onSocketEvent } = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!conversationId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/conversations/${conversationId}/messages`);
      const rows = await Promise.all(
        (data.messages || []).map(async (m) => ({
          ...m,
          text: await decryptMessage(m.ciphertext, { peerId: m.sender_id }),
        }))
      );
      setMessages(rows);
      indexMessages(conversationId, rows);
    } catch (e) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId, enabled, peerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useChatSocket({
    enabled: Boolean(conversationId && enabled),
    topic: conversationId ? `conversation:${conversationId}` : null,
    onEvent: async (data) => {
      onSocketEvent?.(data);
      const payload = data?.payload || data;
      if (payload?.type === 'message' && payload.message) {
        const m = payload.message;
        const text = await decryptMessage(m.ciphertext, { peerId: m.sender_id });
        const row = { ...m, text };
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, row];
        });
        indexMessage(conversationId, row);
      }
    },
  });

  const sendMessage = useCallback(
    async (text, { disappearingSeconds } = {}) => {
      if (!conversationId || !text.trim()) return;
      const { ciphertext, protocol } = await encryptMessage(text.trim(), { peerId });
      const body = { ciphertext, protocol };
      if (disappearingSeconds) body.disappearing_seconds = disappearingSeconds;
      const data = await api.post(`/api/conversations/${conversationId}/messages`, body);
      const m = data.message;
      const row = { ...m, text: text.trim() };
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, row];
      });
      indexMessage(conversationId, row);
    },
    [conversationId, peerId]
  );

  return { messages, loading, error, reload, sendMessage };
}