import {
  DESKTOP_NOTIF_PREF_KEY,
  areDesktopNotificationsEnabled,
  setDesktopNotificationsEnabled,
  isAppInBackground,
  setDesktopBadgeCount,
  incrementDesktopBadge,
  clearDesktopBadge,
  getDesktopBadgeCount,
} from '../desktopNotifications';

describe('desktopNotifications', () => {
  const original = window.sscDesktop;

  beforeEach(() => {
    localStorage.clear();
    window.sscDesktop = {
      isDesktop: true,
      platform: 'win32',
      notifications: { setEnabled: jest.fn(), setBadgeCount: jest.fn() },
    };
  });

  afterEach(() => {
    window.sscDesktop = original;
    localStorage.clear();
  });

  it('defaults desktop notifications to enabled', () => {
    expect(areDesktopNotificationsEnabled()).toBe(true);
  });

  it('persists disabled preference', () => {
    setDesktopNotificationsEnabled(false);
    expect(localStorage.getItem(DESKTOP_NOTIF_PREF_KEY)).toBe('0');
    expect(areDesktopNotificationsEnabled()).toBe(false);
    expect(window.sscDesktop.notifications.setEnabled).toHaveBeenCalledWith(false);
  });

  it('detects background via document.hidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    expect(isAppInBackground()).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    expect(isAppInBackground()).toBe(true);
  });

  it('tracks and syncs tray badge count', () => {
    setDesktopBadgeCount(3);
    expect(getDesktopBadgeCount()).toBe(3);
    expect(window.sscDesktop.notifications.setBadgeCount).toHaveBeenCalledWith(3);
    incrementDesktopBadge();
    expect(getDesktopBadgeCount()).toBe(4);
    clearDesktopBadge();
    expect(getDesktopBadgeCount()).toBe(0);
  });
});