/**
 * Desktop OS notifications (Electron IPC or browser Notification API).
 * Used instead of FCM for Windows/macOS/Linux clients.
 */

export async function ensureNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';
  if (window.sscPush?.requestPermission) {
    return window.sscPush.requestPermission();
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function showDesktopNotification({ title = 'SSC', body = 'New message' } = {}) {
  if (typeof window === 'undefined') return;
  if (document.hasFocus() && !document.hidden) return;

  if (window.sscPush?.showNotification) {
    window.sscPush.showNotification({ title, body }).catch(() => {});
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
}