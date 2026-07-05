import {
  clearPeerTrust,
  getPeerTrust,
  markPeerVerified,
  syncPeerSafetyNumber,
  TRUST_STATUS,
  trustBadgeLabel,
} from '../trustStore';

const PEER = 'u_peer_test';

beforeEach(() => {
  localStorage.clear();
});

describe('trustStore', () => {
  it('defaults to unverified', () => {
    expect(getPeerTrust(PEER).status).toBe(TRUST_STATUS.DEFAULT);
  });

  it('marks peer verified with safety number', () => {
    markPeerVerified(PEER, '1234 5678 9012');
    const trust = getPeerTrust(PEER);
    expect(trust.status).toBe(TRUST_STATUS.VERIFIED);
    expect(trust.safetyNumber).toBe('1234 5678 9012');
    expect(trust.verifiedAt).toBeTruthy();
  });

  it('detects safety number change after verification', () => {
    markPeerVerified(PEER, '1111 2222 3333');
    const status = syncPeerSafetyNumber(PEER, '9999 8888 7777');
    expect(status).toBe(TRUST_STATUS.CHANGED);
    expect(getPeerTrust(PEER).previousSafetyNumber).toBe('1111 2222 3333');
  });

  it('clears trust state', () => {
    markPeerVerified(PEER, '1234 5678');
    clearPeerTrust(PEER);
    expect(getPeerTrust(PEER).status).toBe(TRUST_STATUS.DEFAULT);
  });

  it('maps badge labels', () => {
    expect(trustBadgeLabel(TRUST_STATUS.VERIFIED)).toBe('Verified');
    expect(trustBadgeLabel(TRUST_STATUS.CHANGED)).toBe('Key changed');
    expect(trustBadgeLabel(TRUST_STATUS.DEFAULT)).toBe('Unverified');
  });
});