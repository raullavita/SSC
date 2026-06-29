import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';
import {
  clearAppLockPin,
  hasAppLockPin,
  isValidPin,
  setAppLockPin,
  verifyAppLockPin,
} from '../appLockPin';

global.crypto = webcrypto;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('../hardwareSecretStore', () => ({
  getHardwareSecret: jest.fn(async () => null),
  setHardwareSecret: jest.fn(async () => false),
  removeHardwareSecret: jest.fn(async () => {}),
  isHardwareSecretStoreAvailable: jest.fn(async () => false),
}));

describe('appLockPin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates pin length', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234')).toBe(true);
  });

  it('stores and verifies pin hash', async () => {
    expect(await hasAppLockPin()).toBe(false);
    await setAppLockPin('4242');
    expect(await hasAppLockPin()).toBe(true);
    expect(await verifyAppLockPin('4242')).toBe(true);
    expect(await verifyAppLockPin('9999')).toBe(false);
  });

  it('clears stored pin', async () => {
    await setAppLockPin('5678');
    await clearAppLockPin();
    expect(await hasAppLockPin()).toBe(false);
  });
});