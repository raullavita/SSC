/** Group poll messages — Q.23 (E2E payload + server vote metadata). */

import { isMessageDeleted } from './messageDelete';

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 12;
export const MAX_POLL_QUESTION_LEN = 200;
export const MAX_POLL_OPTION_LEN = 100;

export function serializePollPayload({ question, options }) {
  return JSON.stringify({ question, options });
}

export function parsePollPayload(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  try {
    const data = JSON.parse(plaintext);
    const question = String(data?.question || '').trim();
    const options = Array.isArray(data?.options)
      ? data.options.map((o) => String(o || '').trim()).filter(Boolean)
      : [];
    if (!question || options.length < MIN_POLL_OPTIONS) return null;
    return { question, options: options.slice(0, MAX_POLL_OPTIONS) };
  } catch {
    return null;
  }
}

export function buildPollPayload({ question, options }) {
  const q = String(question || '').trim();
  if (!q) return { ok: false, errorKey: 'pollQuestionRequired' };
  if (q.length > MAX_POLL_QUESTION_LEN) return { ok: false, errorKey: 'pollQuestionTooLong' };

  const cleaned = (options || [])
    .map((o) => String(o || '').trim())
    .filter(Boolean);
  if (cleaned.length < MIN_POLL_OPTIONS) return { ok: false, errorKey: 'pollOptionsMin' };
  if (cleaned.length > MAX_POLL_OPTIONS) return { ok: false, errorKey: 'pollOptionsMax' };

  const tooLong = cleaned.find((o) => o.length > MAX_POLL_OPTION_LEN);
  if (tooLong) return { ok: false, errorKey: 'pollOptionTooLong' };

  const seen = new Set();
  for (const opt of cleaned) {
    const key = opt.toLowerCase();
    if (seen.has(key)) return { ok: false, errorKey: 'pollOptionsDuplicate' };
    seen.add(key);
  }

  return {
    ok: true,
    payload: { question: q, options: cleaned },
  };
}

export function canVoteOnPoll(msg) {
  return Boolean(msg) && msg.message_type === 'poll' && !isMessageDeleted(msg);
}

export function myPollVote(pollVotes, userId) {
  if (!userId || !Array.isArray(pollVotes)) return null;
  const mine = pollVotes.find((v) => v.user_id === userId);
  return typeof mine?.option_index === 'number' ? mine.option_index : null;
}

export function pollVoteStats(pollVotes = [], optionCount = 0) {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const row of pollVotes) {
    const idx = row.option_index;
    if (typeof idx === 'number' && idx >= 0 && idx < optionCount) {
      counts[idx] += 1;
    }
  }
  const total = counts.reduce((sum, n) => sum + n, 0);
  return { counts, total };
}

export function applyPollVoteUpdate(messages, payload) {
  const messageId = payload?.message_id;
  if (!messageId || !Array.isArray(messages)) return messages;
  const pollVotes = payload.poll_votes || [];
  return messages.map((m) => (
    m.message_id === messageId ? { ...m, poll_votes: pollVotes } : m
  ));
}