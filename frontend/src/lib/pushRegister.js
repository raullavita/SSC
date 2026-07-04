/**
 * Register FCM/native push token with SSC API (generic notifications only).
 * Installed clients set window.sscPushToken + window.sscPushPlatform before login.
 */

import { api } from './api';

export async function registerPushTokenIfAvailable() {
  const token = typeof window !== 'undefined' ? window.sscPushToken : null;
  const platform =
    (typeof window !== 'undefined' && window.sscPushPlatform) ||
    process.env.REACT_APP_SSC_PLATFORM ||
    'electron';
  if (!token || token.length < 10) {
    return { skipped: true };
  }
  return api.post('/api/push/register', { token, platform });
}