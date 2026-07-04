/**
 * mediasoup SFU client — Engine 11
 * @see https://github.com/versatica/mediasoup
 */

import { api } from '../lib/api';
import { connectSfuSession } from './sfuSession';

export async function fetchSfuConfig() {
  return api.get('/api/sfu/config');
}

export async function createSfuRoom(conversationId, expectedParticipants) {
  return api.post('/api/sfu/rooms', {
    conversation_id: conversationId,
    expected_participants: expectedParticipants,
  });
}

export async function connectSfuRoom({ wsUrl, roomId, joinToken, peerId, localStream }) {
  if (!wsUrl || !roomId || !joinToken) {
    return { connected: false, reason: 'sfu_disabled' };
  }

  try {
    const session = await connectSfuSession({ wsUrl, roomId, joinToken, peerId });
    let producers = [];
    if (localStream) {
      producers = await session.publishLocalStream(localStream);
    }
    return {
      connected: true,
      reason: 'ok',
      session,
      producers,
      wsUrl,
      roomId,
      joinToken,
    };
  } catch (e) {
    return {
      connected: false,
      reason: e.message || 'sfu_connect_failed',
      wsUrl,
      roomId,
      joinToken,
    };
  }
}