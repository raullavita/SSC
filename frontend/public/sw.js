/* SSC service worker — generic push only; origin-checked (Engine 4). */

const ALLOWED_ORIGINS = new Set([
  self.location.origin,
]);

function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Dev: allow localhost variants
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

self.addEventListener('push', (event) => {
  if (!originAllowed(event.origin)) {
    return;
  }
  let payload = { title: 'SSC', body: 'New message' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload.title = parsed.title || payload.title;
      payload.body = parsed.body || payload.body;
    }
  } catch {
    /* use defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: 'ssc-generic',
      data: { type: 'generic_message' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/chat'));
});