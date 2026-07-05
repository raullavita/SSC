/**
 * Encrypted reactions — dedicated API — Phase C3.
 */

import { api } from '../lib/api';
import { encryptMessage } from '../signal/signalBridge';
import { encryptGroupMessage } from '../signal/groupSenderKeys';

export const REACTION_PROTOCOL = 'signal_v1_reaction';

export async function fetchConversationReactions(conversationId) {
  return api.get(`/api/conversations/${conversationId}/reactions`);
}

export async function sendReaction(
  conversationId,
  { emoji, targetMessageId, peerId, isGroup, groupId, userId, memberIds }
) {
  const payload = JSON.stringify({ emoji, target: targetMessageId });
  let ciphertext;
  let protocol = REACTION_PROTOCOL;
  if (isGroup) {
    ({ ciphertext, protocol } = await encryptGroupMessage(payload, {
      groupId,
      userId,
      conversationId,
      memberIds,
    }));
  } else {
    ({ ciphertext, protocol } = await encryptMessage(payload, { peerId }));
  }
  return api.post(`/api/conversations/${conversationId}/reactions`, {
    target_message_id: targetMessageId,
    ciphertext,
    protocol,
  });
}

export async function removeReaction(reactionId) {
  return api.delete(`/api/reactions/${reactionId}`);
}

export function parseReactionText(text) {
  try {
    const data = JSON.parse(text);
    if (data?.emoji && data?.target) return data;
  } catch {
    /* not a reaction */
  }
  return null;
}