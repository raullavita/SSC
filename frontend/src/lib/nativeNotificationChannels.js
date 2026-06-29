/**
 * Android per-conversation notification channels — Q.44.
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform, isNativeApp } from './platform';

const SscNotificationChannels = registerPlugin('SscNotificationChannels');

export async function ensureConversationNotificationChannel(conversationId) {
  if (!isNativeApp() || getPlatform() !== 'android' || !conversationId) return;
  try {
    await SscNotificationChannels.ensureConversationChannel({ conversationId });
  } catch (e) {
    console.warn('[SSC] ensure notification channel failed', e);
  }
}

export async function syncConversationChannelMute(conversationId, muted) {
  if (!isNativeApp() || getPlatform() !== 'android' || !conversationId) return;
  try {
    await SscNotificationChannels.setConversationChannelMuted({
      conversationId,
      muted: !!muted,
    });
  } catch (e) {
    console.warn('[SSC] sync channel mute failed', e);
  }
}