/**
 * Register FCM/native push token with SSC API (generic notifications only).
 */

import { api } from './api';

async function resolvePushToken() {
  if (typeof window === 'undefined') return null;
  if (window.sscPushToken && window.sscPushToken.length >= 10) {
    return window.sscPushToken;
  }
  if (window.sscPush?.getToken) {
    try {
      const token = await window.sscPush.getToken();
      if (token && token.length >= 10) {
        window.sscPushToken = token;
        window.sscPushPlatform = window.sscPush.platform || 'electron';
        return token;
      }
    } catch {
      /* native bridge unavailable */
    }
  }
  return null;
}

function resolvePlatform() {
  if (typeof window !== 'undefined' && window.sscPushPlatform) {
    return window.sscPushPlatform;
  }
  if (typeof window !== 'undefined' && window.sscPush?.platform) {
    return window.sscPush.platform;
  }
  return process.env.REACT_APP_SSC_PLATFORM || 'electron';
}

function isFcmToken(token, platform) {
  if (!token || token.length < 10) return false;
  if (token.startsWith('ssc-electron-')) return false;
  if (platform === 'electron') return false;
  return true;
}

export async function registerPushTokenIfAvailable() {
  const token = await resolvePushToken();
  const platform = resolvePlatform();
  if (!isFcmToken(token, platform)) {
    return { skipped: true, reason: 'desktop_uses_local_notifications' };
  }
  return api.post('/api/push/register', { token, platform });
}