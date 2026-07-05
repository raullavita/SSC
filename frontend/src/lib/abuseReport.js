/**
 * Abuse / spam report API — Engine 8.
 */

import { api } from './api';

export async function submitAbuseReport({
  targetUserId,
  conversationId = null,
  reason,
  sampleText = '',
}) {
  return api.post('/api/abuse/report', {
    target_user_id: targetUserId,
    conversation_id: conversationId,
    reason,
    sample_text: sampleText,
  });
}