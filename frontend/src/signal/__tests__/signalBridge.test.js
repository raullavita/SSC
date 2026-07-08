import { normalizePreKeyBundlePayload } from '../signalBridge';

describe('normalizePreKeyBundlePayload', () => {
  test('converts electron camelCase bundle to API snake_case', () => {
    const payload = normalizePreKeyBundlePayload('1', {
      registrationId: 4242,
      identityKey: 'aWRl',
      signedPreKey: {
        keyId: 9,
        publicKey: 'c2lnbmVk',
        signature: 'c2ln',
      },
      preKeys: [{ keyId: 3, publicKey: 'cHJl' }],
      kyberPreKey: { keyId: 7, publicKey: 'a3liZXItcHVibGljLWtleS1oZXJlLWxvbmc=', signature: 'a3li' },
    });
    expect(payload.device_id).toBe('1');
    expect(payload.registration_id).toBe(4242);
    expect(payload.signed_prekey).toEqual({
      key_id: 9,
      public_key: 'c2lnbmVk',
      signature: 'c2ln',
    });
    expect(payload.prekeys).toEqual([{ key_id: 3, public_key: 'cHJl' }]);
    expect(payload.kyber_prekey.key_id).toBe(7);
  });
});