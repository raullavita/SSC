import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useChatSocket } from './useChatSocket';

function decodePlaceholder(ciphertext) {
  try {
    return atob(ciphertext);
  } catch {
    return '[encrypted]';
  }
}

export function useChatMessages(conversationId, enabled) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!conversationId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/conversations/${conversationId}/messages`);
      setMessages(
        (data.messages || []).map((m) => ({
          ...m,
          text: decodePlaceholder(m.ciphertext),
        }))
      );
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
    onEvent: (data) => {
      if (data?.type === 'message' && data.message) {
        const m = data.message;
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, { ...m, text: decodePlaceholder(m.ciphertext) }];
        });
      }
    },
  });

  const sendMessage = useCallback(
    async (text) => {
      if (!conversationId || !text.trim()) return;
      const ciphertext = btoa(text);
      const data = await api.post(`/api/conversations/${conversationId}/messages`, {
        ciphertext,
        protocol: 'placeholder',
      });
      const m = data.message;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, { ...m, text }];
      });
    },
    [conversationId]
  );

  return { messages, loading, error, reload, sendMessage };
}