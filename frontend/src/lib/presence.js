/**
 * Presence heartbeat + last-seen privacy helpers — Engine 4.
 */

import { api } from './api';

const HEARTBEAT_MS = 60_000;
let timer = null;

export async function sendHeartbeat() {
  try {
    await api.post('/api/presence/heartbeat', {});
  } catch {
    /* offline */
  }
}

export function startPresenceHeartbeat() {
  stopPresenceHeartbeat();
  sendHeartbeat();
  timer = setInterval(sendHeartbeat, HEARTBEAT_MS);
}

export function stopPresenceHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function fetchPresence(userId, { conversationId } = {}) {
  const query = conversationId
    ? `?conversation_id=${encodeURIComponent(conversationId)}`
    : '';
  return api.get(`/api/presence/users/${encodeURIComponent(userId)}${query}`);
}

export async function updatePrivacySettings(patch) {
  return api.patch('/api/privacy', patch);
}

export function formatPresenceBucket(bucket) {
  switch (bucket) {
    case 'online':
      return 'Online';
    case 'recently':
      return 'Recently active';
    case 'away':
      return 'Away';
    default:
      return '';
  }
}