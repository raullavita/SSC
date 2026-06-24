/** Cross-surface contacts roster refresh — WebSocket + native push (TASK C). */

export const CONTACTS_REFRESH_EVENT = 'ssc-contacts-refresh';

export function dispatchContactsRefresh(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONTACTS_REFRESH_EVENT, { detail }));
}

export function subscribeContactsRefresh(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => handler(e.detail || {});
  window.addEventListener(CONTACTS_REFRESH_EVENT, listener);
  return () => window.removeEventListener(CONTACTS_REFRESH_EVENT, listener);
}

/** WS payload types that should trigger a roster reload. */
export const CONTACT_WS_TYPES = new Set([
  'friend-request',
  'friend-request-sent',
  'friend-accepted',
  'friend-rejected',
  'contacts-changed',
]);

export function isContactRealtimeEvent(data) {
  return CONTACT_WS_TYPES.has(data?.type);
}