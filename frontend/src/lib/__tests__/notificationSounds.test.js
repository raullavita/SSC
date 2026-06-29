import {
  NOTIFICATION_SOUND_KEY,
  NOTIFICATION_SOUND_PRESETS,
  desktopNotificationSilentFlag,
  getNotificationSound,
  normalizeNotificationSound,
  setNotificationSound,
  shouldPlayCustomDesktopChime,
} from '../notificationSounds';

jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(() => ({
    setMessageNotificationSound: jest.fn().mockResolvedValue({ preset: 'default' }),
  })),
}));

jest.mock('../platform', () => ({
  isNativeApp: jest.fn(() => false),
  isElectronApp: jest.fn(() => true),
  getPlatform: jest.fn(() => 'web'),
}));

describe('notificationSounds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to system sound preset', () => {
    expect(getNotificationSound()).toBe('default');
  });

  it('persists valid presets', () => {
    setNotificationSound('soft');
    expect(localStorage.getItem(NOTIFICATION_SOUND_KEY)).toBe('soft');
    expect(getNotificationSound()).toBe('soft');
  });

  it('normalizes unknown presets', () => {
    expect(normalizeNotificationSound('nope')).toBe('default');
  });

  it('lists four optional presets', () => {
    expect(NOTIFICATION_SOUND_PRESETS.map((p) => p.id)).toEqual([
      'default', 'soft', 'bright', 'silent',
    ]);
  });

  it('controls desktop silent and custom chime flags', () => {
    setNotificationSound('default');
    expect(desktopNotificationSilentFlag()).toBe(false);
    expect(shouldPlayCustomDesktopChime()).toBe(false);
    setNotificationSound('bright');
    expect(desktopNotificationSilentFlag()).toBe(true);
    expect(shouldPlayCustomDesktopChime()).toBe(true);
    setNotificationSound('silent');
    expect(shouldPlayCustomDesktopChime()).toBe(false);
  });
});