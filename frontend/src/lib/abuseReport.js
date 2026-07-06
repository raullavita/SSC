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

export async function blockUser(targetUserId) {
  return api.post('/api/abuse/block', { target_user_id: targetUserId });
}

export async function listBlockedUsers() {
  return api.get('/api/abuse/blocks');
}