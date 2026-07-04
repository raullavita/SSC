/**
 * Encrypted reactions — signal_v1_reaction — Engine 13.
 */

import { api } from '../lib/api';
import { encryptMessage } from '../signal/signalBridge';

export const REACTION_PROTOCOL = 'signal_v1_reaction';

export async function sendReaction(conversationId, { emoji, targetMessageId, peerId }) {
  const payload = JSON.stringify({ emoji, target: targetMessageId });
  const { ciphertext } = await encryptMessage(payload, { peerId });
  return api.post(`/api/conversations/${conversationId}/messages`, {
    ciphertext,
    protocol: REACTION_PROTOCOL,
  });
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