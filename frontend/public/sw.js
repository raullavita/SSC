/* SSC service worker — push notifications + offline shell */
const CACHE = 'ssc-v1';
const PURGE_CACHES_MESSAGE = 'SSC_PURGE_CACHES';

self.addEventListener('message', (event) => {
  if (event.data?.type !== PURGE_CACHES_MESSAGE) return;
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  })());
});

self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'SSC', body: 'New encrypted message' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  const type = payload.type || 'message';
  let options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'ssc-message',
    data: payload.data || { conversation_id: payload.conversation_id || null },
    vibrate: [80, 40, 80],
    renotify: true,
  };
  if (payload.silent) {
    options.silent = true;
  }
  if (type === 'call') {
    options.body = payload.body || 'Incoming call';
    options.tag = payload.tag || 'ssc-call';
    options.vibrate = [200, 100, 200, 100, 200];
    options.requireInteraction = true;  // keep on screen for calls
    options.data = { ...options.data, type: 'call', mode: payload.data?.mode || 'audio' };
    options.actions = [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' }
    ];
  } else if (type === 'friend_request') {
    options.body = payload.body || 'New friend request';
    options.tag = payload.tag || 'ssc-friend';
  } else if (type === 'friend_accept') {
    options.body = payload.body || 'Friend request accepted';
    options.tag = payload.tag || 'ssc-friend-accept';
  } else if (type === 'status') {
    options.body = payload.body || 'Posted a new status';
    options.tag = payload.tag || 'ssc-status';
    options.data = { ...options.data, type: 'status', ...payload.data };
  } else if (type === 'group_event') {
    options.body = payload.body || 'Group update';
    options.tag = payload.tag || 'ssc-group';
    options.data = { ...options.data, type: 'group_event', ...payload.data };
  }
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  let target = '/chat';
  if (data.type === 'call') {
    target = data.conversation_id ? `/chat/${data.conversation_id}` : '/chat';
    // Post message to frontend to handle call (answer/decline or open)
    event.waitUntil((async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        const url = new URL(c.url);
        if (url.origin === self.location.origin) {
          c.focus();
          c.postMessage({ type: 'call_notification', action: action || 'open', data });
          return;
        }
      }
      await self.clients.openWindow(target);
    })());
    return;
  } else if (data.type === 'status') {
    target = '/chat';
  } else if (data.type === 'friend_request' || data.type === 'friend_accept') {
    target = '/chat';
  } else if (data.conversation_id) {
    target = `/chat/${data.conversation_id}`;
  }
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      const url = new URL(c.url);
      if (url.origin === self.location.origin) {
        c.focus();
        c.postMessage({ type: 'navigate', target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
