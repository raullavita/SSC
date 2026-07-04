/**
 * mediasoup SFU client scaffold — Engine 9.
 * @see https://github.com/versatica/mediasoup
 */

import { api } from '../lib/api';

export async function fetchSfuConfig() {
  return api.get('/api/sfu/config');
}

export async function createSfuRoom(conversationId, expectedParticipants) {
  return api.post('/api/sfu/rooms', {
    conversation_id: conversationId,
    expected_participants: expectedParticipants,
  });
}

export function connectSfuRoom({ wsUrl, roomId, joinToken }) {
  if (!wsUrl || !roomId) {
    return { connected: false, reason: 'sfu_disabled' };
  }
  // mediasoup-client wiring lands when SFU server is deployed.
  return { connected: false, reason: 'scaffold_only', wsUrl, roomId, joinToken };
}