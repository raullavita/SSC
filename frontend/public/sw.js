/* SSC service worker — push notifications + offline shell */
const CACHE = 'ssc-v1';
const PURGE_CACHES_MESSAGE = 'SSC_PURGE_CACHES';
const GENERIC_TITLE = 'SSC';
const GENERIC_BODY = 'New activity';

self.addEventListener('message', (event) => {
  const sourceUrl = event.source?.url || '';
  if (sourceUrl && !sourceUrl.startsWith(self.location.origin)) return;
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
  let payload = { title: GENERIC_TITLE, body: GENERIC_BODY };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  const type = payload.type || payload.data?.type || 'message';
  const data = payload.data || { conversation_id: payload.conversation_id || null, type };
  let options = {
    body: GENERIC_BODY,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'ssc-message',
    data: { ...data, type },
    vibrate: [80, 40, 80],
    renotify: true,
  };
  if (payload.silent) {
    options.silent = true;
  }
  if (type === 'call') {
    options.tag = payload.tag || 'ssc-call';
    options.vibrate = [200, 100, 200, 100, 200];
    options.requireInteraction = true;
    options.data = { ...options.data, type: 'call', mode: data.mode || 'audio' };
    options.actions = [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' }
    ];
  } else if (type === 'friend_request') {
    options.tag = payload.tag || 'ssc-friend';
  } else if (type === 'friend_accept') {
    options.tag = payload.tag || 'ssc-friend-accept';
  } else if (type === 'status') {
    options.tag = payload.tag || 'ssc-status';
    options.data = { ...options.data, type: 'status' };
  } else if (type === 'group_event') {
    options.tag = payload.tag || 'ssc-group';
    options.data = { ...options.data, type: 'group_event' };
  }
  event.waitUntil(self.registration.showNotification(GENERIC_TITLE, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  let target = '/chat';
  if (data.type === 'call') {
    target = data.conversation_id ? `/chat/${data.conversation_id}` : '/chat';
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