/**
 * Abuse / spam report API — Engine 8.
 */

import { api } from './api';

export async function submitAbuseReport({
  targetUserId,
  conversationId = null,
  reason,
  sampleText = '',
  alsoBlock = false,
}) {
  return api.post('/api/abuse/report', {
    target_user_id: targetUserId,
    conversation_id: conversationId,
    reason,
    sample_text: sampleText,
    also_block: alsoBlock,
  });
}

/** Standalone block API — Settings report panel uses submitAbuseReport({ alsoBlock: true }) instead. */
export async function blockUser(targetUserId) {
  return api.post('/api/abuse/block', { target_user_id: targetUserId });
}

export async function listBlockedUsers() {
  return api.get('/api/abuse/blocks');
}

export async function checkBlockedBy(targetUserId) {
  const data = await api.get(`/api/abuse/blocked-by/${encodeURIComponent(targetUserId)}`);
  return Boolean(data.blocked);
}

export async function unblockUser(targetUserId) {
  return api.delete(`/api/abuse/block/${encodeURIComponent(targetUserId)}`);
}