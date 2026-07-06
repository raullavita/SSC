/**
 * Encrypted stories — signal_v1_story — Step 7.
 */

import { api } from '../lib/api';
import { encryptMessage } from '../signal/signalBridge';

const STORY_PROTOCOL = 'signal_v1_story';

export async function createStory(plaintext, { peerId } = {}) {
  if (!peerId) {
    throw new Error('story_peer_required');
  }
  const { ciphertext } = await encryptMessage(plaintext, { peerId });
  return api.post('/api/stories', {
    ciphertext,
    protocol: STORY_PROTOCOL,
  });
}

export async function fetchStoriesFeed() {
  const data = await api.get('/api/stories/feed');
  return data.stories || [];
}

export async function deleteStory(storyId) {
  return api.delete(`/api/stories/${storyId}`);
}