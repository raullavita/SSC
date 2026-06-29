import { resolveSignalCiphertextForDevice } from '../multiDeviceMessaging';

describe('multiDeviceMessaging', () => {
  it('picks per-device ciphertext when present', () => {
    const msg = {
      protocol: 'signal_v1',
      ciphertext: 'legacy',
      signal_message_type: 1,
      signal_device_ciphertexts: {
        2: { ciphertext: 'dev2', signal_message_type: 3 },
      },
    };
    expect(resolveSignalCiphertextForDevice(msg, 2)).toEqual({
      ciphertext: 'dev2',
      signal_message_type: 3,
    });
    expect(resolveSignalCiphertextForDevice(msg, 1).ciphertext).toBe('legacy');
  });
});