import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
import {
  saveVaultCredential,
  loadVaultCredential,
  clearVaultCredential,
  clearAllVaultCredentials,
} from '../vaultCredentialStore';

jest.mock('../platform', () => ({
  isInstalledClient: () => true,
}));

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
});