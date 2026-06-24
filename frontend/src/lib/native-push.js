/**
 * Capacitor FCM/APNs push — native shell only. Web/PWA still uses push.js (VAPID).
 */
import { api } from './api';
import { dispatchContactsRefresh } from './contactRealtime';
import { getPlatform, isNativeApp } from './platform';

let listenersAttached = false;

function handleNotificationData(data, action = 'open') {
  if (!data || typeof data !== 'object') return;
  const type = data.type || 'message';

  if (type === 'call') {
    const payload = {
      type: 'call_notification',
      action,
      data: {
        type: 'call',
        mode: data.mode || 'audio',
        from: data.from,
        conversation_id: data.conversation_id || null,
        group: data.group === '1' || data.group === 'true' || data.group === true,
      },
    };
    sessionStorage.setItem('ssc_pending_call', JSON.stringify(payload));
    const target = data.conversation_id ? `/chat/${data.conversation_id}` : '/chat';
    if (window.location.pathname.startsWith('/chat')) {
      window.dispatchEvent(new CustomEvent('ssc-call-notification', { detail: payload }));
    } else {
      window.location.assign(target);
    }
    return;
  }

  if (type === 'friend_request' || type === 'friend_accept') {
    dispatchContactsRefresh({ type, full: type === 'friend_accept' });
    if (!window.location.pathname.startsWith('/chat')) {
      window.location.assign('/chat');
    }
    return;
  }

  if (data.conversation_id) {
    window.location.assign(`/chat/${data.conversation_id}`);
  }
}

function attachListeners(PushNotifications) {
  if (listenersAttached) return;
  listenersAttached = true;

  PushNotifications.addListener('registration', async (token) => {
    const platform = getPlatform();
    if (platform !== 'android' && platform !== 'ios') return;
    try {
      await api.post('/push/native/subscribe', {
        token: token.value,
        platform,
      });
      localStorage.setItem('ssc_native_push_token', token.value);
      console.info('[SSC] Native push token registered');
    } catch (e) {
      console.warn('[SSC] Native push register failed', e);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[SSC] Push registration error', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const data = notification?.data || {};
    const type = data.type || notification?.data?.type;
    if (type === 'friend_request' || type === 'friend_accept') {
      dispatchContactsRefresh({ type, full: type === 'friend_accept' });
      return;
    }
    if (data.type === 'call' && data.silent !== '1') {
      handleNotificationData(data, 'open');
    }
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    handleNotificationData(event?.notification?.data || {}, 'open');
  });
}

/** Attach FCM/APNs listeners once at app start (no auth required). */
export async function initNativePush() {
  if (!isNativeApp()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    attachListeners(PushNotifications);
  } catch (e) {
    console.warn('[SSC] Native push listeners failed', e);
  }
}

/** Request permission and register device token (call after login). */
export async function subscribeNativePush() {
  if (!isNativeApp()) return null;
  const { getSessionToken } = await import('./sessionStore');
  if (!getSessionToken()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    attachListeners(PushNotifications);

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return null;
    }
    await PushNotifications.register();
    return true;
  } catch (e) {
    console.warn('[SSC] Native push setup failed', e);
    return null;
  }
}

export async function unsubscribeNativePush(lastToken) {
  if (!isNativeApp() || !lastToken) return;
  const platform = getPlatform();
  if (platform !== 'android' && platform !== 'ios') return;
  try {
    await api.post('/push/native/unsubscribe', { token: lastToken, platform });
  } catch {}
}