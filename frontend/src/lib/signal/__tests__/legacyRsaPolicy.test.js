jest.mock('../../platform', () => ({
  isInstalledClient: jest.fn(),
}));

import { canDecryptLegacyRsa, maySendLegacyRsa } from '../legacyRsaPolicy';

const { isInstalledClient } = require('../../platform');

describe('legacyRsaPolicy', () => {
  it('blocks legacy RSA send on installed clients', () => {
    isInstalledClient.mockReturnValue(true);
    expect(maySendLegacyRsa()).toBe(false);
  });

  it('allows legacy RSA send on browser shell', () => {
    isInstalledClient.mockReturnValue(false);
    expect(maySendLegacyRsa()).toBe(true);
  });

  it('always allows legacy RSA decrypt during migration', () => {
    expect(canDecryptLegacyRsa()).toBe(true);
  });
});