import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { parseAttachmentText } from './attachments';
import { castPollVote, createPoll, decryptPollVoteIndex, fetchPoll, parsePollText } from './polls';
import { parseReactionText } from './reactions';
import { useDisappearingMessages } from './useDisappearingMessages';
import {
  deleteMessageApi,
  editMessageApi,
  forwardMessageApi,
} from './messageActions';
import { indexMessage, indexMessages, removeMessageFromIndex } from '../search/messageIndex';
import { getSealedSenderEnabled } from '../lib/chatPrefs';
import {
  GROUP_SENDER_KEY_DIST_PROTOCOL,
  decryptGroupMessage,
  encryptGroupMessage,
  ingestSenderKeyDistribution,
  isSenderKeyDistributionMessage,
} from '../signal/groupSenderKeys';
import { encryptSealedMessageForRecipients } from '../signal/sealedSender';
import { getLocalDeviceId } from '../lib/deviceLink';
import { storeMessageRecord } from '../signal/messageRecords';
import {
  decryptWithRetry,
  resolveCiphertext,
} from '../signal/sesameRetry';
import {
  decryptMessage,
  encryptMessage,
  encryptMessageForRecipients,
} from '../signal/signalBridge';
import { useChatSocket } from './useChatSocket';

function parseMessageContent(text, messageKind) {
  if (messageKind === 'poll') {
    const poll = parsePollText(text);
    return { text: null, reaction: null, attachment: null, poll };
  }
  if (messageKind === 'reaction') {
    const reaction = parseReactionText(text);
    return { text: null, reaction, attachment: null, poll: null };
  }
  const attachment = parseAttachmentText(text);
  if (attachment) {
    return { text: null, reaction: null, attachment, poll: null };
  }
  if (messageKind === 'attachment') {
    return { text: null, reaction: null, attachment: null, poll: null };
  }
  return { text, reaction: null, attachment: null, poll: null };
}

async function hydrateGroupMessage(m, { groupId }) {
  if (isSenderKeyDistributionMessage(m)) {
    await ingestSenderKeyDistribution(m.ciphertext, {
      peerId: m.sender_id,
      protocol: m.protocol,
    });
    return null;
  }
  const raw = await decryptGroupMessage(m.ciphertext, {
    groupId,
    senderId: m.sender_id,
    protocol: m.protocol,
  });
  const parsed = parseMessageContent(raw, m.message_kind);
  return {
    ...m,
    text: parsed.text,
    reaction: parsed.reaction,
    attachment: parsed.attachment,
    poll: parsed.poll,
  };
}

export function useChatMessages(
  conversationId,
  enabled,
  peerId,
  { onSocketEvent, wsToken, isGroup, groupId, userId, memberIds = [] } = {}
) {
  const [messages, setMessages] = useState([]);
  const [pollMeta, setPollMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { remainingById } = useDisappearingMessages(messages, setMessages);

  const reload = useCallback(async () => {
    if (!conversationId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/conversations/${conversationId}/messages`);
      const rows = [];
      for (const m of data.messages || []) {
        if (m.message_kind === 'deleted') {
          rows.push({ ...m, text: null, reaction: null, attachment: null, poll: null });
          continue;
        }
        if (isGroup) {
          const row = await hydrateGroupMessage(m, { groupId });
          if (row) rows.push(row);
        } else {
          const ct = resolveCiphertext(m, getLocalDeviceId());
          const raw = await decryptWithRetry(
            { ...m, ciphertext: ct },
            {
              peerId: m.sender_id,
              localDeviceId: getLocalDeviceId(),
              conversationId,
            }
          );
          const parsed = parseMessageContent(raw, m.message_kind);
          rows.push({
            ...m,
            text: parsed.text,
            reaction: parsed.reaction,
            attachment: parsed.attachment,
            poll: parsed.poll,
          });
        }
      }
      setMessages(rows);
      const pollRows = rows.filter((m) => m.poll_id);
      const meta = {};
      await Promise.all(
        pollRows.map(async (m) => {
          try {
            const data = await fetchPoll(conversationId, m.poll_id);
            let viewerVote = null;
            if (data.viewer_vote_ciphertext && peerId) {
              try {
                viewerVote = await decryptPollVoteIndex(data.viewer_vote_ciphertext, { peerId });
              } catch {
                viewerVote = null;
              }
            }
            meta[m.poll_id] = {
              tallies: data.tallies || {},
              viewerVote,
            };
          } catch {
            meta[m.poll_id] = { tallies: {}, viewerVote: null };
          }
        })
      );
      setPollMeta(meta);
      indexMessages(
        conversationId,
        rows.filter((m) => m.text)
      );
    } catch (e) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId, enabled, isGroup, groupId, peerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useChatSocket({
    enabled: Boolean(conversationId && enabled),
    topic: conversationId ? `conversation:${conversationId}` : null,
    wsToken,
    userId,
    onEvent: async (data) => {
      onSocketEvent?.(data);
      const payload = data?.payload || data;
      if (payload?.type === 'read_receipt') return;
      if (payload?.type === 'message_edited' && payload.message) {
        const m = payload.message;
        if (m.message_kind === 'deleted') return;
        try {
          let row;
          if (isGroup) {
            const raw = await decryptGroupMessage(m.ciphertext, {
              groupId,
              senderId: m.sender_id,
              protocol: m.protocol,
            });
            const parsed = parseMessageContent(raw, m.message_kind);
            row = { ...m, text: parsed.text, reaction: null, attachment: parsed.attachment, poll: parsed.poll };
          } else {
            const ct = resolveCiphertext(m, getLocalDeviceId());
            const raw = await decryptWithRetry(
              { ...m, ciphertext: ct },
              {
                peerId: m.sender_id,
                localDeviceId: getLocalDeviceId(),
                conversationId,
              }
            );
            const parsed = parseMessageContent(raw, m.message_kind);
            row = {
              ...m,
              text: parsed.text,
              reaction: parsed.reaction,
              attachment: parsed.attachment,
              poll: parsed.poll,
            };
          }
          setMessages((prev) => prev.map((x) => (x.id === m.id ? row : x)));
          if (row.text) indexMessage(conversationId, row);
        } catch {
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...m, text: null } : x)));
        }
        return;
      }
      if (payload?.type === 'message_deleted') {
        const { message_id: messageId, scope, message: tombstone } = payload;
        if (scope === 'everyone' && tombstone) {
          setMessages((prev) =>
            prev.map((x) =>
              x.id === messageId
                ? { ...x, ...tombstone, text: null, attachment: null, poll: null, message_kind: 'deleted' }
                : x
            )
          );
        } else {
          setMessages((prev) => prev.filter((x) => x.id !== messageId));
          removeMessageFromIndex(conversationId, messageId);
        }
        return;
      }
      if (payload?.type === 'message' && payload.message) {
        const m = payload.message;
        if (isGroup) {
          if (isSenderKeyDistributionMessage(m)) {
            await ingestSenderKeyDistribution(m.ciphertext, {
              peerId: m.sender_id,
              protocol: m.protocol,
            });
            return;
          }
          const raw = await decryptGroupMessage(m.ciphertext, {
            groupId,
            senderId: m.sender_id,
            protocol: m.protocol,
          });
          const parsed = parseMessageContent(raw, m.message_kind);
          const row = {
            ...m,
            text: parsed.text,
            reaction: parsed.reaction,
            attachment: parsed.attachment,
            poll: parsed.poll,
          };
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, row];
          });
          if (row.text) indexMessage(conversationId, row);
          if (m.poll_id) {
            setPollMeta((prev) => ({
              ...prev,
              [m.poll_id]: prev[m.poll_id] || { tallies: {}, viewerVote: null },
            }));
          }
          return;
        }
        const ct = resolveCiphertext(m, getLocalDeviceId());
        const raw = await decryptWithRetry(
          { ...m, ciphertext: ct },
          {
            peerId: m.sender_id,
            localDeviceId: getLocalDeviceId(),
            conversationId,
          }
        );
        const parsed = parseMessageContent(raw, m.message_kind);
        const row = {
          ...m,
          text: parsed.text,
          reaction: parsed.reaction,
          attachment: parsed.attachment,
          poll: parsed.poll,
        };
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, row];
        });
        if (row.text) indexMessage(conversationId, row);
        if (m.poll_id) {
          setPollMeta((prev) => ({
            ...prev,
            [m.poll_id]: prev[m.poll_id] || { tallies: {}, viewerVote: null },
          }));
        }
      }
    },
  });

  const displayMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.message_kind !== 'reaction' &&
          !m.reaction &&
          m.message_kind !== 'sender_key_distribution'
      ),
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
          conversationId,
          memberIds,
        }));
      } else if (getSealedSenderEnabled()) {
        const encrypted = await encryptSealedMessageForRecipients(text.trim(), {
          peerId,
          localUserId: userId,
          localDeviceId: getLocalDeviceId(),
          includeSelfDevices: true,
        });
        ciphertext = encrypted.ciphertext;
        protocol = encrypted.protocol;
        const body = {
          ciphertext,
          protocol,
          device_ciphertexts: encrypted.device_ciphertexts,
          sealed: true,
        };
        if (disappearingSeconds) body.disappearing_seconds = disappearingSeconds;
        if (replyTo) body.reply_to = replyTo;
        const data = await api.post(`/api/conversations/${conversationId}/messages`, body);
        const m = data.message;
        storeMessageRecord(m.id, {
          plaintext: text.trim(),
          peerId,
          conversationId,
          deviceCiphertexts: encrypted.device_ciphertexts,
        });
        const row = { ...m, text: text.trim(), reaction: null, attachment: null };
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, row];
        });
        indexMessage(conversationId, row);
        return;
      } else {
        const encrypted = await encryptMessageForRecipients(text.trim(), {
          peerId,
          localUserId: userId,
          localDeviceId: getLocalDeviceId(),
          includeSelfDevices: true,
        });
        ciphertext = encrypted.ciphertext;
        protocol = encrypted.protocol;
        const body = {
          ciphertext,
          protocol,
          device_ciphertexts: encrypted.device_ciphertexts,
        };
        if (disappearingSeconds) body.disappearing_seconds = disappearingSeconds;
        if (replyTo) body.reply_to = replyTo;
        const data = await api.post(`/api/conversations/${conversationId}/messages`, body);
        const m = data.message;
        storeMessageRecord(m.id, {
          plaintext: text.trim(),
          peerId,
          conversationId,
          deviceCiphertexts: encrypted.device_ciphertexts,
        });
        const row = { ...m, text: text.trim(), reaction: null, attachment: null };
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, row];
        });
        indexMessage(conversationId, row);
        return;
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

  const sendPoll = useCallback(
    async (question, options) => {
      if (!conversationId || !question?.trim() || !peerId) return;
      const data = await createPoll(conversationId, {
        question: question.trim(),
        options,
        peerId,
      });
      const m = data.message;
      const poll = parsePollText(
        JSON.stringify({
          question: question.trim(),
          options: options.map((o) => o.trim()).filter(Boolean),
        })
      );
      const row = { ...m, poll, text: null, reaction: null, attachment: null };
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, row];
      });
      if (data.poll?.id) {
        setPollMeta((prev) => ({
          ...prev,
          [data.poll.id]: { tallies: {}, viewerVote: null },
        }));
      }
    },
    [conversationId, peerId]
  );

  const votePoll = useCallback(
    async (pollId, optionIndex) => {
      if (!conversationId || !peerId || pollId == null) return;
      const data = await castPollVote(conversationId, pollId, {
        optionIndex,
        peerId,
      });
      let viewerVote = optionIndex;
      if (data.viewer_vote_ciphertext && peerId) {
        try {
          viewerVote = await decryptPollVoteIndex(data.viewer_vote_ciphertext, { peerId });
        } catch {
          viewerVote = optionIndex;
        }
      }
      setPollMeta((prev) => ({
        ...prev,
        [pollId]: {
          tallies: data.tallies || {},
          viewerVote,
        },
      }));
    },
    [conversationId, peerId]
  );

  const encryptCtx = useMemo(
    () => ({ peerId, isGroup, groupId, userId, memberIds, conversationId }),
    [peerId, isGroup, groupId, userId, memberIds, conversationId]
  );

  const editMessage = useCallback(
    async (messageId, text) => {
      if (!messageId || !text?.trim()) return;
      const data = await editMessageApi(messageId, text, encryptCtx);
      const m = data.message;
      const row = { ...m, text: text.trim(), reaction: null, attachment: null, poll: null };
      setMessages((prev) => prev.map((x) => (x.id === messageId ? row : x)));
      indexMessage(conversationId, row);
    },
    [conversationId, encryptCtx]
  );

  const deleteMessage = useCallback(
    async (messageId, scope = 'me') => {
      if (!messageId) return;
      const data = await deleteMessageApi(messageId, scope);
      if (scope === 'everyone' && data.message) {
        setMessages((prev) =>
          prev.map((x) =>
            x.id === messageId
              ? { ...x, ...data.message, text: null, attachment: null, poll: null, message_kind: 'deleted' }
              : x
          )
        );
      } else {
        setMessages((prev) => prev.filter((x) => x.id !== messageId));
        removeMessageFromIndex(conversationId, messageId);
      }
    },
    [conversationId]
  );

  const forwardMessage = useCallback(
    async (sourceMessage, targetConversationId, targetPeerId, targetIsGroup = false) => {
      if (!sourceMessage?.text || !targetConversationId) return;
      const data = await forwardMessageApi(sourceMessage.text, {
        sourceMessageId: sourceMessage.id,
        conversationId: targetConversationId,
        peerId: targetPeerId,
        isGroup: targetIsGroup,
        groupId: targetIsGroup ? targetConversationId : undefined,
        userId,
        memberIds,
      });
      if (targetConversationId === conversationId) {
        const m = data.message;
        const row = {
          ...m,
          text: sourceMessage.text,
          reaction: null,
          attachment: null,
          poll: null,
        };
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, row];
        });
        indexMessage(conversationId, row);
      }
      return data.message;
    },
    [conversationId, userId, memberIds]
  );

  return {
    messages: displayMessages,
    pollMeta,
    remainingById,
    loading,
    error,
    reload,
    sendMessage,
    sendPoll,
    votePoll,
    editMessage,
    deleteMessage,
    forwardMessage,
  };
}