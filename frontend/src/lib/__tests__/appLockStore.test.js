jest.mock('../platform', () => ({
  isInstalledClient: jest.fn(() => true),
}));

jest.mock('../appLockPin', () => ({
  clearAppLockPin: jest.fn(async () => {}),
}));

describe('appLockStore', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.isolateModules(() => {
      store = require('../appLockStore');
    });
  });

  it('is only available on installed clients', () => {
    expect(store.isAppLockFeatureAvailable()).toBe(true);
  });

  it('persists enabled and biometric flags', () => {
    store.setAppLockEnabled(true);
    store.setAppLockBiometricPrefEnabled(true);
    expect(store.isAppLockEnabled()).toBe(true);
    expect(localStorage.getItem('ssc_app_lock_biometric')).toBe('1');
  });

  it('clears enabled flags on panic path', async () => {
    store.setAppLockEnabled(true);
    store.setAppLockBiometricPrefEnabled(true);
    await store.clearAppLockSettings();
    expect(store.isAppLockEnabled()).toBe(false);
    expect(store.isAppLockBiometricPrefEnabled()).toBe(false);
  });
});