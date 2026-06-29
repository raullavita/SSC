/**
 * Windows/macOS desktop notifications — Electron shell only.
 * Keeps WS alive via tray; shows native toasts + focuses window for calls when backgrounded.
 */
import { isElectronApp } from './platform';
import {
  desktopNotificationSilentFlag,
  playMessageNotificationSound,
  shouldPlayCustomDesktopChime,
} from './notificationSounds';

export const DESKTOP_NOTIF_PREF_KEY = 'ssc_desktop_notifications_enabled';

let desktopBadgeCount = 0;

export function areDesktopNotificationsEnabled() {
  if (!isElectronApp()) return false;
  const v = localStorage.getItem(DESKTOP_NOTIF_PREF_KEY);
  return v !== '0' && v !== 'false';
}

export function setDesktopNotificationsEnabled(enabled) {
  if (!isElectronApp()) return;
  localStorage.setItem(DESKTOP_NOTIF_PREF_KEY, enabled ? '1' : '0');
  syncDesktopNotificationPref();
}

export function syncDesktopNotificationPref() {
  if (!isElectronApp()) return;
  const enabled = areDesktopNotificationsEnabled();
  try {
    const result = window.sscDesktop?.notifications?.setEnabled?.(enabled);
    Promise.resolve(result).catch(() => {});
  } catch {
    // ignore IPC errors in dev shell
  }
}

export function getDesktopBadgeCount() {
  return desktopBadgeCount;
}

export function setDesktopBadgeCount(count) {
  if (!isElectronApp()) return 0;
  desktopBadgeCount = Math.max(0, Math.floor(Number(count) || 0));
  try {
    const result = window.sscDesktop?.notifications?.setBadgeCount?.(desktopBadgeCount);
    Promise.resolve(result).catch(() => {});
  } catch {
    // ignore IPC errors in dev shell
  }
  return desktopBadgeCount;
}

export function incrementDesktopBadge(delta = 1) {
  return setDesktopBadgeCount(desktopBadgeCount + Math.max(1, Math.floor(delta)));
}

export function clearDesktopBadge() {
  return setDesktopBadgeCount(0);
}

export function bindDesktopBadgeClearOnFocus() {
  if (!isElectronApp() || typeof window === 'undefined') return () => {};
  const clear = () => {
    if (!document.hidden && document.hasFocus()) clearDesktopBadge();
  };
  window.addEventListener('focus', clear);
  document.addEventListener('visibilitychange', clear);
  return () => {
    window.removeEventListener('focus', clear);
    document.removeEventListener('visibilitychange', clear);
  };
}

export function isAppInBackground() {
  if (typeof document === 'undefined') return false;
  return document.hidden || !document.hasFocus();
}

async function showDesktopNotification(opts) {
  if (!isElectronApp() || !areDesktopNotificationsEnabled()) return false;
  try {
    const shown = await window.sscDesktop?.notifications?.show?.(opts);
    if (shown && opts?.incrementBadge !== false) incrementDesktopBadge();
    return shown;
  } catch {
    return false;
  }
}

export async function focusDesktopWindow() {
  if (!isElectronApp()) return false;
  try {
    return await window.sscDesktop?.window?.focus?.();
  } catch {
    return false;
  }
}

export function shouldNotifyWhileBackgrounded() {
  return areDesktopNotificationsEnabled() && isAppInBackground();
}

export async function notifyDesktopIncomingCall({
  fromUsername,
  mode = 'audio',
  group = false,
  conversationId = null,
}) {
  if (!isElectronApp() || !areDesktopNotificationsEnabled()) return;
  await focusDesktopWindow();
  const label = group
    ? 'Group call'
    : (mode === 'video' ? 'Video call' : 'Incoming call');
  const body = fromUsername ? `@${fromUsername}` : 'Someone is calling';
  await showDesktopNotification({
    title: label,
    body,
    tag: 'ssc-incoming-call',
    urgency: 'critical',
    kind: 'call',
    conversationId,
    incrementBadge: false,
  });
}

export async function notifyDesktopMessage({
  conversationId,
  senderUsername,
  isGroup = false,
  groupName = null,
  preview = 'New message',
}) {
  if (!shouldNotifyWhileBackgrounded()) return;
  const title = isGroup
    ? (groupName || 'Group message')
    : (senderUsername ? `@${senderUsername}` : 'New message');
  const shown = await showDesktopNotification({
    title,
    body: preview,
    tag: `ssc-msg-${conversationId}`,
    conversationId,
    kind: 'message',
    silent: desktopNotificationSilentFlag(),
  });
  if (shown && shouldPlayCustomDesktopChime()) playMessageNotificationSound();
}

export async function notifyDesktopFriendRequest(fromUsername) {
  if (!shouldNotifyWhileBackgrounded()) return;
  const shown = await showDesktopNotification({
    title: 'Friend request',
    body: fromUsername ? `@${fromUsername} wants to connect` : 'New friend request',
    tag: 'ssc-friend-request',
    kind: 'friend_request',
    silent: desktopNotificationSilentFlag(),
  });
  if (shown && shouldPlayCustomDesktopChime()) playMessageNotificationSound();
}

export function subscribeDesktopNavigation(handler) {
  if (!isElectronApp()) return () => {};
  const unsub = window.sscDesktop?.notifications?.onNavigate?.(handler);
  return typeof unsub === 'function' ? unsub : () => {};
}

const SYSTEM_MESSAGE_TYPES = new Set(['sender_key_distribution', 'status_skdm']);

function messagePreview(messageType) {
  switch (messageType) {
    case 'voice': return 'Voice message';
    case 'sticker': return 'Sticker';
    case 'gif': return 'GIF';
    case 'image': return 'Photo';
    case 'file': return 'File';
    case 'video': return 'Video';
    case 'poll': return 'Poll';
    case 'location': return 'Location';
    default: return 'New message';
  }
}

export async function maybeNotifyDesktopMessage(incoming, {
  myUserId,
  activeId,
  conversations,
  myContacts,
  formatGroupLabel,
  isPeerMutedFn,
}) {
  if (!incoming?.conversation_id || incoming.sender_id === myUserId) return;
  if (SYSTEM_MESSAGE_TYPES.has(incoming.message_type)) return;

  const conv = (conversations || []).find((c) => c.conversation_id === incoming.conversation_id);
  if (!conv) return;

  if (!conv.is_group && conv.peer?.user_id && isPeerMutedFn?.(myContacts, conv.peer.user_id)) {
    return;
  }

  if (!isAppInBackground() && activeId === incoming.conversation_id) return;

  const isGroup = !!conv.is_group;
  const senderUsername = conv.members?.find((m) => m.user_id === incoming.sender_id)?.username
    || conv.peer?.username
    || null;
  const groupName = isGroup ? (formatGroupLabel?.(conv) || 'Group') : null;

  await notifyDesktopMessage({
    conversationId: incoming.conversation_id,
    senderUsername,
    isGroup,
    groupName,
    preview: messagePreview(incoming.message_type),
  });
}