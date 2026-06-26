jest.mock('../../platform', () => ({
  isInstalledClient: jest.fn(),
}));

import { maySendLegacyRsa } from '../legacyRsaPolicy';

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
});