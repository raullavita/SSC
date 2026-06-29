jest.mock('../memoryWipe', () => ({
  dispatchMemoryWipe: jest.fn(),
}));

jest.mock('../localStorageFootprint', () => ({
  clearLocalStorageSessionSecrets: jest.fn(),
}));

jest.mock('../sessionStorageFootprint', () => ({
  clearSessionStorageFootprint: jest.fn(),
}));

jest.mock('../vault', () => ({
  purgeLegacyPrivateKeyFromSession: jest.fn(),
}));

jest.mock('../verification', () => ({
  purgeLegacyVerificationFlags: jest.fn(),
}));

jest.mock('../sessionStore', () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => null),
  usesBearerAuth: jest.fn(() => true),
}));

jest.mock('../vaultCredentialStore', () => ({
  clearVaultCredential: jest.fn(),
  clearAllVaultCredentials: jest.fn(),
}));

jest.mock('../appLockStore', () => ({
  clearAppLockSettings: jest.fn(async () => {}),
}));

jest.mock('../deviceWrapCrypto', () => ({
  clearDeviceWrapSecret: jest.fn(async () => {}),
}));

import { clearAppLockSettings } from '../appLockStore';
import { clearDeviceWrapSecret } from '../deviceWrapCrypto';
import { executeClientFootprintWipe } from '../clientFootprintOrchestrator';

describe('clientFootprintOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAppLockSettings.mockResolvedValue(undefined);
    clearDeviceWrapSecret.mockResolvedValue(undefined);
  });

  it('panic wipe clears hardware-backed device wrap secret', () => {
    executeClientFootprintWipe('panic');
    expect(clearDeviceWrapSecret).toHaveBeenCalledTimes(1);
  });

  it('logout wipe does not clear device wrap secret', () => {
    executeClientFootprintWipe('logout', { userId: 'user-1' });
    expect(clearDeviceWrapSecret).not.toHaveBeenCalled();
  });
});