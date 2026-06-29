import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

jest.mock('../platform', () => ({
  isInstalledClient: () => true,
  isNativeApp: () => false,
  isElectronApp: () => false,
}));

jest.mock('../hardwareSecretStore', () => ({
  isHardwareSecretStoreAvailable: jest.fn(async () => false),
  getHardwareSecret: jest.fn(async () => null),
  setHardwareSecret: jest.fn(async () => false),
  removeHardwareSecret: jest.fn(async () => {}),
}));

import { DEVICE_WRAP_KEY } from '../deviceWrapCrypto';
import {
  saveVaultCredential,
  loadVaultCredential,
  clearVaultCredential,
  clearAllVaultCredentials,
} from '../vaultCredentialStore';

beforeAll(() => {
  global.crypto = webcrypto;
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
});

describe('vaultCredentialStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips vault password for a user', async () => {
    await saveVaultCredential('user-1', 'secret-pass-123');
    const loaded = await loadVaultCredential('user-1');
    expect(loaded).toBe('secret-pass-123');
    expect(localStorage.getItem('ssc_vault_wrap_user-1')).not.toContain('secret-pass-123');
    expect(localStorage.getItem(DEVICE_WRAP_KEY)).toBeTruthy();
  });

  it('returns null when credential missing', async () => {
    expect(await loadVaultCredential('missing')).toBeNull();
  });

  it('clears per-user and all credentials', async () => {
    await saveVaultCredential('a', 'pass-a');
    await saveVaultCredential('b', 'pass-b');
    clearVaultCredential('a');
    expect(await loadVaultCredential('a')).toBeNull();
    expect(await loadVaultCredential('b')).toBe('pass-b');
    clearAllVaultCredentials();
    expect(await loadVaultCredential('b')).toBeNull();
  });

  it('stores wrap key material in hardware when available', async () => {
    const {
      isHardwareSecretStoreAvailable,
      getHardwareSecret,
      setHardwareSecret,
    } = require('../hardwareSecretStore');
    let hwValue = null;
    isHardwareSecretStoreAvailable.mockResolvedValue(true);
    getHardwareSecret.mockImplementation(async () => hwValue);
    setHardwareSecret.mockImplementation(async (_key, value) => {
      hwValue = value;
      return true;
    });

    await saveVaultCredential('user-hw', 'hw-pass');
    expect(setHardwareSecret).toHaveBeenCalledWith(DEVICE_WRAP_KEY, expect.any(String));
    expect(localStorage.getItem(DEVICE_WRAP_KEY)).toBeNull();
    expect(await loadVaultCredential('user-hw')).toBe('hw-pass');
  });
});