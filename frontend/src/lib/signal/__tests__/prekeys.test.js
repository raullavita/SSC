jest.mock('../../api', () => ({
  api: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../nativeLibsignal', () => ({
  isNativeLibsignalAvailable: jest.fn(),
  generatePreKeyBundle: jest.fn(),
  clearAllSignalSessions: jest.fn(() => Promise.resolve({ cleared: true })),
  setNativeLocalDeviceId: jest.fn(() => Promise.resolve({ device_id: 1 })),
}));

jest.mock('../devices', () => ({
  registerLocalDevice: jest.fn(() => Promise.resolve({ device_id: 1 })),
}));

import { api } from '../../api';
import { registerLocalDevice } from '../devices';
import {
  clearAllSignalSessions,
  generatePreKeyBundle,
  isNativeLibsignalAvailable,
  setNativeLocalDeviceId,
} from '../nativeLibsignal';
import { __resetPrekeysUploadStateForTests, ensurePreKeysUploaded } from '../prekeys';

describe('ensurePreKeysUploaded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPrekeysUploadStateForTests();
    isNativeLibsignalAvailable.mockReturnValue(true);
    setNativeLocalDeviceId.mockResolvedValue({ device_id: 1 });
    registerLocalDevice.mockResolvedValue({ device_id: 1 });
    clearAllSignalSessions.mockResolvedValue({ cleared: true });
    generatePreKeyBundle.mockResolvedValue({
      identity_key_public: 'LOCAL_ID',
      registration_id: 1,
      device_id: 1,
      signed_prekey_id: 1,
      signed_prekey_public: 'a',
      signed_prekey_signature: 'b',
      kyber_prekey_id: 1,
      kyber_prekey_public: 'c',
      kyber_prekey_signature: 'd',
      one_time_prekeys: [{ prekey_id: 1, public: 'e' }],
      libsignal_version: '0.96.2',
    });
  });

  it('skips upload when server identity matches local', async () => {
    api.get.mockResolvedValue({
      data: { ready: true, identity_key_public: 'LOCAL_ID' },
    });
    const result = await ensurePreKeysUploaded();
    expect(result.already).toBe(true);
    expect(api.put).not.toHaveBeenCalled();
    expect(clearAllSignalSessions).not.toHaveBeenCalled();
  });

  it('re-uploads when server identity differs from local', async () => {
    api.get.mockResolvedValue({
      data: { ready: true, identity_key_public: 'OLD_SERVER_ID' },
    });
    api.put.mockResolvedValue({ data: { status: 'ok' } });
    const result = await ensurePreKeysUploaded();
    expect(result.uploaded).toBe(true);
    expect(result.identity_rotated).toBe(true);
    expect(api.put).toHaveBeenCalled();
    expect(clearAllSignalSessions).toHaveBeenCalled();
  });

  it('throws when session clear fails after identity mismatch', async () => {
    api.get.mockResolvedValue({
      data: { ready: true, identity_key_public: 'OLD_SERVER_ID' },
    });
    clearAllSignalSessions.mockResolvedValue({ cleared: false, reason: 'unavailable' });

    await expect(ensurePreKeysUploaded()).rejects.toThrow('session_clear_failed');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('skips on web when libsignal is unavailable', async () => {
    isNativeLibsignalAvailable.mockReturnValue(false);
    const result = await ensurePreKeysUploaded();
    expect(result.skipped).toBe(true);
    expect(api.get).not.toHaveBeenCalled();
  });
});