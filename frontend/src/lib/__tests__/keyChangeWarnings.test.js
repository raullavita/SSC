const storage = {};

jest.mock('../verification', () => ({
  clearPeerVerification: jest.fn((peerUserId) => {
    delete storage[`ssc_verified_v2_${peerUserId}`];
  }),
}));

jest.mock('../identityKey', () => ({
  resolveUserIdentity: (user) => {
    if (!user?.signal_identity_key_public) return null;
    return { type: 'signal_v1', signalPublicB64: user.signal_identity_key_public };
  },
  identityStorageFingerprint: (identity) => `signal:${identity.signalPublicB64}`,
}));

import { clearPeerVerification } from '../verification';
import {
  TRUSTED_IDENTITY_PREFIX,
  acknowledgePeerIdentity,
  getPeerIdentityFingerprint,
  getTrustedIdentityFingerprint,
  handlePeerIdentityRotation,
  isPeerIdentityChanged,
  seedTrustedIdentityIfMissing,
  setTrustedIdentityFingerprint,
} from '../keyChangeWarnings';

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  clearPeerVerification.mockImplementation((peerUserId) => {
    delete storage[`ssc_verified_v2_${peerUserId}`];
  });
  global.localStorage = {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
    key: (index) => Object.keys(storage)[index] ?? null,
    get length() { return Object.keys(storage).length; },
  };
});

describe('keyChangeWarnings', () => {
  const peer = {
    user_id: 'u_peer',
    signal_identity_key_public: 'identity-a',
    signal_prekeys_ready: true,
    identity_primary: 'signal_v1',
  };

  it('seeds trusted fingerprint on first contact', () => {
    seedTrustedIdentityIfMissing(peer);
    const fp = getPeerIdentityFingerprint(peer);
    expect(getTrustedIdentityFingerprint(peer.user_id)).toBe(fp);
  });

  it('detects identity change against trusted fingerprint', () => {
    seedTrustedIdentityIfMissing(peer);
    expect(getTrustedIdentityFingerprint(peer.user_id)).toBe('signal:identity-a');
    const changedPeer = {
      ...peer,
      signal_identity_key_public: 'identity-b',
    };
    expect(isPeerIdentityChanged(changedPeer)).toBe(true);
  });

  it('acknowledge updates trusted fingerprint', () => {
    setTrustedIdentityFingerprint(peer.user_id, 'old');
    acknowledgePeerIdentity(peer);
    expect(getTrustedIdentityFingerprint(peer.user_id)).toBe('signal:identity-a');
  });

  it('rotation clears verification storage key and dispatches event', () => {
    storage[`ssc_verified_v2_${peer.user_id}`] = '{"v":3}';
    const handler = jest.fn();
    window.addEventListener('ssc-key-change', handler);
    handlePeerIdentityRotation(peer.user_id);
    expect(clearPeerVerification).toHaveBeenCalledWith(peer.user_id);
    expect(storage[`ssc_verified_v2_${peer.user_id}`]).toBeUndefined();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('ssc-key-change', handler);
  });

  it('uses trusted identity prefix', () => {
    expect(TRUSTED_IDENTITY_PREFIX).toBe('ssc_trusted_identity_');
  });
});