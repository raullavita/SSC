import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { decryptMessage } from '../signal/signalBridge';
import { decryptGroupMessage } from '../signal/groupSenderKeys';
import {
  fetchConversationReactions,
  parseReactionText,
  removeReaction,
  sendReaction as postReaction,
} from './reactions';

async function hydrateReaction(row, { peerId, isGroup, groupId }) {
  try {
    let raw;
    if (isGroup) {
      raw = await decryptGroupMessage(row.ciphertext, {
        groupId,
        senderId: row.sender_id,
        protocol: row.protocol,
      });
    } else {
      raw = await decryptMessage(row.ciphertext, { peerId: row.sender_id });
    }
    const parsed = parseReactionText(raw);
    if (!parsed?.emoji || !parsed?.target) return null;
    return {
      id: row.id,
      emoji: parsed.emoji,
      target: parsed.target,
      sender_id: row.sender_id,
      mine: Boolean(row.mine),
    };
  } catch {
    return null;
  }
}

function aggregateReactions(rows) {
  const byEmoji = new Map();
  for (const row of rows) {
    const key = row.emoji;
    if (!byEmoji.has(key)) {
      byEmoji.set(key, { emoji: key, count: 0, mine: false, reactionIds: [], senders: [] });
    }
    const entry = byEmoji.get(key);
    entry.count += 1;
    entry.reactionIds.push(row.id);
    entry.senders.push(row.sender_id);
    if (row.mine) entry.mine = true;
  }
  return Array.from(byEmoji.values());
}

export function useReactions({
  conversationId,
  enabled,
  peerId,
  isGroup,
  groupId,
  userId,
  memberIds = [],
}) {
  const [reactionRows, setReactionRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!conversationId || !enabled) return;
    setLoading(true);
    try {
      const data = await fetchConversationReactions(conversationId);
      const hydrated = [];
      for (const row of data.reactions || []) {
        const parsed = await hydrateReaction(row, { peerId, isGroup, groupId });
        if (parsed) hydrated.push(parsed);
      }
      setReactionRows(hydrated);
    } catch {
      setReactionRows([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, enabled, peerId, isGroup, groupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSocketPayload = useCallback(
    async (payload) => {
      if (payload?.type === 'reaction_added' && payload.reaction) {
        const parsed = await hydrateReaction(payload.reaction, { peerId, isGroup, groupId });
        if (parsed) {
          setReactionRows((prev) => {
            if (prev.some((x) => x.id === parsed.id)) return prev;
            return [...prev, parsed];
          });
        }
      }
      if (payload?.type === 'reaction_removed' && payload.reaction?.id) {
        setReactionRows((prev) => prev.filter((x) => x.id !== payload.reaction.id));
      }
    },
    [peerId, isGroup, groupId]
  );

  const reactionsByTarget = useMemo(() => {
    const map = {};
    for (const row of reactionRows) {
      if (!map[row.target]) map[row.target] = [];
      map[row.target].push(row);
    }
    const aggregated = {};
    for (const [target, rows] of Object.entries(map)) {
      aggregated[target] = aggregateReactions(rows);
    }
    return aggregated;
  }, [reactionRows]);

  const sendReaction = useCallback(
    async (emoji, targetMessageId) => {
      if (!conversationId || !targetMessageId) return;
      const existing = reactionRows.find(
        (r) => r.target === targetMessageId && r.emoji === emoji && r.sender_id === userId
      );
      if (existing) {
        await removeReaction(existing.id);
        setReactionRows((prev) => prev.filter((x) => x.id !== existing.id));
        return;
      }
      const data = await postReaction(conversationId, {
        emoji,
        targetMessageId,
        peerId,
        isGroup,
        groupId,
        userId,
        memberIds,
      });
      const parsed = await hydrateReaction(data.reaction, { peerId, isGroup, groupId });
      if (parsed) {
        setReactionRows((prev) => {
          if (prev.some((x) => x.id === parsed.id)) return prev;
          return [...prev, { ...parsed, mine: true }];
        });
      }
    },
    [conversationId, peerId, isGroup, groupId, userId, memberIds, reactionRows]
  );

  return {
    reactionsByTarget,
    sendReaction,
    reloadReactions: reload,
    reactionsLoading: loading,
    handleReactionSocketPayload: handleSocketPayload,
  };
}