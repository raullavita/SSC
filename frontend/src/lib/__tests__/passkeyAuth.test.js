import {
  fetchPasskeyConfig,
  isPasskeySupported,
} from '../passkeyAuth';

jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('passkeyAuth', () => {
  it('detects passkey API support', () => {
    expect(typeof isPasskeySupported()).toBe('boolean');
  });

  it('fetchPasskeyConfig falls back when request fails', async () => {
    const { api } = require('../api');
    api.get.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchPasskeyConfig()).resolves.toEqual({ enabled: false, rp_id: '' });
  });
});