/**
 * Encrypted polls — signal_v1_poll — Step 7.
 */

import { api } from '../lib/api';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';

const POLL_PROTOCOL = 'signal_v1_poll';

export function parsePollText(text) {
  try {
    const data = JSON.parse(text);
    if (data?.question && Array.isArray(data?.options) && data.options.length >= 2) {
      return data;
    }
  } catch {
    /* not a poll */
  }
  return null;
}

export async function createPoll(conversationId, { question, options, peerId }) {
  const payload = JSON.stringify({
    question: question.trim(),
    options: options.map((o) => o.trim()).filter(Boolean),
  });
  const { ciphertext } = await encryptMessage(payload, { peerId });
  const parsed = JSON.parse(payload);
  return api.post(`/api/conversations/${conversationId}/polls`, {
    ciphertext,
    protocol: POLL_PROTOCOL,
    option_count: parsed.options.length,
  });
}

export async function fetchPoll(conversationId, pollId) {
  return api.get(`/api/conversations/${conversationId}/polls/${pollId}`);
}

export async function decryptPollVoteIndex(ciphertext, { peerId }) {
  if (!ciphertext) return null;
  const plain = await decryptMessage(ciphertext, { peerId });
  const parsed = JSON.parse(plain);
  return typeof parsed.option_index === 'number' ? parsed.option_index : null;
}

export async function castPollVote(conversationId, pollId, { optionIndex, peerId }) {
  const payload = JSON.stringify({ option_index: optionIndex });
  const { ciphertext } = await encryptMessage(payload, { peerId });
  return api.post(`/api/conversations/${conversationId}/polls/${pollId}/votes`, {
    ciphertext,
    protocol: POLL_PROTOCOL,
  });
}