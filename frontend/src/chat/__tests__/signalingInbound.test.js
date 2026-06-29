jest.mock('../../lib/signal/installedMessaging', () => ({
  usesSignalOnlyMessaging: jest.fn(),
}));

jest.mock('../../lib/signal/webrtcSignaling', () => ({
  getSignalingProtocol: jest.fn((msg) => msg?.signaling_protocol || 'legacy_cleartext'),
  isEncryptedSignaling: jest.fn(),
  SignalingProtocol: { LEGACY_CLEARTEXT: 'legacy_cleartext', SIGNAL_V1: 'signal_v1' },
  unpackIncomingSignaling: jest.fn(),
}));

import { usesSignalOnlyMessaging } from '../../lib/signal/installedMessaging';
import { isEncryptedSignaling, unpackIncomingSignaling } from '../../lib/signal/webrtcSignaling';
import { resolveIncomingSignaling, SignalingInboundError } from '../signalingInbound';

describe('resolveIncomingSignaling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usesSignalOnlyMessaging.mockReturnValue(false);
  });

  it('returns cleartext payload on web when sdp is present', async () => {
    const data = { type: 'call-offer', from: 'peer', sdp: { type: 'offer' } };
    const result = await resolveIncomingSignaling(data, { myUserId: 'me', peerUserId: 'peer' });
    expect(result).toEqual({ ok: true, signal: data });
    expect(unpackIncomingSignaling).not.toHaveBeenCalled();
  });

  it('rejects cleartext sdp on installed clients', async () => {
    usesSignalOnlyMessaging.mockReturnValue(true);
    const data = { type: 'call-offer', from: 'peer', sdp: { type: 'offer' } };
    const result = await resolveIncomingSignaling(data, { myUserId: 'me', peerUserId: 'peer' });
    expect(result).toEqual({
      ok: false,
      error: SignalingInboundError.CLEARTEXT_REJECTED,
      encrypted: false,
    });
  });

  it('rejects cleartext group signaling on web clients', async () => {
    usesSignalOnlyMessaging.mockReturnValue(false);
    const data = {
      type: 'call-offer',
      from: 'peer',
      group: true,
      sdp: { type: 'offer' },
    };
    const result = await resolveIncomingSignaling(data, { myUserId: 'me', peerUserId: 'peer' });
    expect(result).toEqual({
      ok: false,
      error: SignalingInboundError.CLEARTEXT_REJECTED,
      encrypted: false,
    });
    expect(unpackIncomingSignaling).not.toHaveBeenCalled();
  });

  it('returns NO_SDP for non-encrypted payloads without sdp', async () => {
    isEncryptedSignaling.mockReturnValue(false);
    const result = await resolveIncomingSignaling(
      { type: 'call-offer', from: 'peer' },
      { myUserId: 'me', peerUserId: 'peer' },
    );
    expect(result).toEqual({ ok: false, error: SignalingInboundError.NO_SDP, encrypted: false });
  });

  it('decrypts encrypted signaling', async () => {
    isEncryptedSignaling.mockReturnValue(true);
    unpackIncomingSignaling.mockResolvedValue({
      type: 'call-offer',
      from: 'peer',
      sdp: { type: 'offer' },
    });
    const result = await resolveIncomingSignaling(
      { type: 'call-offer', from: 'peer', signaling_protocol: 'signal_v1' },
      { myUserId: 'me', peerUserId: 'peer' },
    );
    expect(result.ok).toBe(true);
    expect(result.signal.sdp).toEqual({ type: 'offer' });
  });

  it('returns DECRYPT_FAILED when unpack throws', async () => {
    isEncryptedSignaling.mockReturnValue(true);
    unpackIncomingSignaling.mockRejectedValue(new Error('bad mac'));
    const result = await resolveIncomingSignaling(
      { type: 'call-offer', from: 'peer', signaling_protocol: 'signal_v1' },
      { myUserId: 'me', peerUserId: 'peer' },
    );
    expect(result).toEqual({ ok: false, error: SignalingInboundError.DECRYPT_FAILED, encrypted: true });
  });
});