import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { parseAttachmentText } from './attachments';
import { parseReactionText, sendReaction as postReaction } from './reactions';
import { indexMessage, indexMessages } from '../search/messageIndex';
import { getSealedSenderEnabled } from '../lib/chatPrefs';
import {
  decryptGroupMessage,
  encryptGroupMessage,
  ingestSenderKeyDistribution,
  isSenderKeyDistribution,
} from '../signal/groupSenderKeys';
import { encryptSealedMessage } from '../signal/sealedSender';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { useChatSocket } from './useChatSocket';

function parseMessageContent(text, messageKind) {
  if (messageKind === 'reaction') {
    const reaction = parseReactionText(text);
    return { text: null, reaction, attachment: null };
  }
  const attachment = parseAttachmentText(text);
  if (attachment) {
    return { text: null, reaction: null, attachment };
  }
  if (messageKind === 'attachment') {
    return { text: null, reaction: null, attachment: null };
  }
  return { text, reaction: null, attachment: null };
}

export function useChatMessages(
  conversationId,
  enabled,
  peerId,
  { onSocketEvent, wsToken, isGroup, groupId, userId, memberIds = [] } = {}
) {
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
          const raw = isGroup
            ? await decryptGroupMessage(m.ciphertext, { groupId, senderId: m.sender_id })
            : await decryptMessage(m.ciphertext, { peerId: m.sender_id });
          const parsed = parseMessageContent(raw, m.message_kind);
          return {
            ...m,
            text: parsed.text,
            reaction: parsed.reaction,
            attachment: parsed.attachment,
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
  }, [conversationId, enabled, isGroup, groupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useChatSocket({
    enabled: Boolean(conversationId && enabled),
    topic: conversationId ? `conversation:${conversationId}` : null,
    wsToken,
    onEvent: async (data) => {
      onSocketEvent?.(data);
      const payload = data?.payload || data;
      if (payload?.type === 'read_receipt') return;
      if (payload?.type === 'message' && payload.message) {
        const m = payload.message;
        if (isGroup && isSenderKeyDistribution(m.ciphertext)) {
          await ingestSenderKeyDistribution(m.ciphertext, { peerId: m.sender_id });
          return;
        }
        const raw = isGroup
          ? await decryptGroupMessage(m.ciphertext, { groupId, senderId: m.sender_id })
          : await decryptMessage(m.ciphertext, { peerId: m.sender_id });
        const parsed = parseMessageContent(raw, m.message_kind);
        const row = {
          ...m,
          text: parsed.text,
          reaction: parsed.reaction,
          attachment: parsed.attachment,
        };
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

  const displayMessages = useMemo(
    () => messages.filter((m) => !m.reaction),
    [messages]
  );

  const sendMessage = useCallback(
    async (text, { disappearingSeconds, replyTo } = {}) => {
      if (!conversationId || !text.trim()) return;
      let ciphertext;
      let protocol;
      let sealed = false;
      if (isGroup) {
        ({ ciphertext, protocol } = await encryptGroupMessage(text.trim(), {
          groupId,
          userId,
          memberIds,
        }));
      } else if (getSealedSenderEnabled()) {
        ({ ciphertext, protocol, sealed } = await encryptSealedMessage(text.trim(), { peerId }));
      } else {
        ({ ciphertext, protocol } = await encryptMessage(text.trim(), { peerId }));
      }
      const body = { ciphertext, protocol };
      if (sealed) body.sealed = true;
      if (disappearingSeconds) body.disappearing_seconds = disappearingSeconds;
      if (replyTo) body.reply_to = replyTo;
      const data = await api.post(`/api/conversations/${conversationId}/messages`, body);
      const m = data.message;
      const row = { ...m, text: text.trim(), reaction: null, attachment: null };
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, row];
      });
      indexMessage(conversationId, row);
    },
    [conversationId, peerId, isGroup, groupId, userId, memberIds]
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
      const row = { ...m, reaction: { emoji, target: targetMessageId }, text: null, attachment: null };
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, row];
      });
    },
    [conversationId, peerId]
  );

  return {
    messages: displayMessages,
    reactionsByTarget,
    loading,
    error,
    reload,
    sendMessage,
    sendReaction,
  };
}