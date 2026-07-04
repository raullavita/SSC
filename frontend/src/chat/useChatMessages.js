import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { parseReactionText, sendReaction as postReaction } from './reactions';
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
        (data.messages || []).map(async (m) => {
          const text = await decryptMessage(m.ciphertext, { peerId: m.sender_id });
          const reaction = m.message_kind === 'reaction' ? parseReactionText(text) : null;
          return {
            ...m,
            text: reaction ? null : text,
            reaction,
          };
        })
      );
      setMessages(rows);
      indexMessages(
        conversationId,
        rows.filter((m) => m.text)
      );
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
        const reaction = m.message_kind === 'reaction' ? parseReactionText(text) : null;
        const row = { ...m, text: reaction ? null : text, reaction };
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, row];
        });
        if (row.text) indexMessage(conversationId, row);
      }
    },
  });

  const reactionsByTarget = useMemo(() => {
    const map = {};
    for (const m of messages) {
      if (!m.reaction?.target) continue;
      const key = m.reaction.target;
      if (!map[key]) map[key] = [];
      map[key].push({ emoji: m.reaction.emoji, sender_id: m.sender_id, id: m.id });
    }
    return map;
  }, [messages]);

  const sendMessage = useCallback(
    async (text, { disappearingSeconds, replyTo } = {}) => {
      if (!conversationId || !text.trim()) return;
      const { ciphertext, protocol } = await encryptMessage(text.trim(), { peerId });
      const body = { ciphertext, protocol };
      if (disappearingSeconds) body.disappearing_seconds = disappearingSeconds;
      if (replyTo) body.reply_to = replyTo;
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

  const sendReaction = useCallback(
    async (emoji, targetMessageId) => {
      if (!conversationId || !targetMessageId) return;
      const data = await postReaction(conversationId, {
        emoji,
        targetMessageId,
        peerId,
      });
      const m = data.message;
      const row = { ...m, reaction: { emoji, target: targetMessageId }, text: null };
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, row];
      });
    },
    [conversationId, peerId]
  );

  return {
    messages,
    reactionsByTarget,
    loading,
    error,
    reload,
    sendMessage,
    sendReaction,
  };
}