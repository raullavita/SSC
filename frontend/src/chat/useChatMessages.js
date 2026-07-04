import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { useChatSocket } from './useChatSocket';

export function useChatMessages(conversationId, enabled, peerId) {
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
    } catch (e) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  useChatSocket({
    enabled: Boolean(conversationId && enabled),
    topic: conversationId ? `conversation:${conversationId}` : null,
    onEvent: async (data) => {
      if (data?.type === 'message' && data.message) {
        const m = data.message;
        const text = await decryptMessage(m.ciphertext, { peerId: m.sender_id });
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, { ...m, text }];
        });
      }
    },
  });

  const sendMessage = useCallback(
    async (text) => {
      if (!conversationId || !text.trim()) return;
      const { ciphertext, protocol } = await encryptMessage(text.trim(), { peerId });
      const data = await api.post(`/api/conversations/${conversationId}/messages`, {
        ciphertext,
        protocol,
      });
      const m = data.message;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, { ...m, text: text.trim() }];
      });
    },
    [conversationId, peerId]
  );

  return { messages, loading, error, reload, sendMessage };
}