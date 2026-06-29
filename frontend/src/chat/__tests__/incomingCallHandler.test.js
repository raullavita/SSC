jest.mock('../../lib/api', () => ({
  api: { get: jest.fn() },
}));

jest.mock('../../lib/signal/x3dh', () => ({
  ensureSignalSession: jest.fn(),
}));

jest.mock('../../lib/desktopNotifications', () => ({
  notifyDesktopIncomingCall: jest.fn(),
}));

jest.mock('../signalingInbound', () => ({
  resolveIncomingSignaling: jest.fn(),
}));

import { api } from '../../lib/api';
import { notifyDesktopIncomingCall } from '../../lib/desktopNotifications';
import { ensureSignalSession } from '../../lib/signal/x3dh';
import { resolveIncomingSignaling } from '../signalingInbound';
import {
  handleIncomingCallOffer,
  handleIncomingSfuInvite,
  reportIncomingCallOfferError,
} from '../incomingCallHandler';

describe('incomingCallHandler', () => {
  const t = (key) => key;
  const toast = { error: jest.fn() };
  const setCallState = jest.fn();
  const setGroupCallState = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    ensureSignalSession.mockResolvedValue(undefined);
    notifyDesktopIncomingCall.mockResolvedValue(undefined);
    api.get.mockResolvedValue({ data: { user_id: 'peer', username: 'dots' } });
  });

  it('sets call state for a decrypted 1:1 offer', async () => {
    resolveIncomingSignaling.mockResolvedValue({
      ok: true,
      signal: { type: 'call-offer', from: 'peer', mode: 'audio', sdp: { type: 'offer' } },
    });

    await handleIncomingCallOffer(
      { type: 'call-offer', from: 'peer' },
      { user: { user_id: 'me' }, t, toast, setCallState, setGroupCallState },
    );

    expect(setCallState).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'incoming',
      peer: { user_id: 'peer', username: 'dots' },
    }));
  });

  it('toasts when encrypted signaling cannot be decrypted', async () => {
    resolveIncomingSignaling.mockResolvedValue({
      ok: false,
      error: 'decrypt_failed',
      encrypted: true,
    });

    await handleIncomingCallOffer(
      { type: 'call-offer', from: 'peer' },
      { user: { user_id: 'me' }, t, toast, setCallState, setGroupCallState },
    );

    expect(toast.error).toHaveBeenCalledWith('callSignalingDecryptFailed');
    expect(setCallState).not.toHaveBeenCalled();
  });

  it('reportIncomingCallOfferError surfaces toast', () => {
    reportIncomingCallOfferError(new Error('boom'), { t, toast });
    expect(toast.error).toHaveBeenCalledWith('callIncomingFailed');
  });

  it('sets SFU group call state for call-sfu-invite', async () => {
    await handleIncomingSfuInvite(
      {
        type: 'call-sfu-invite',
        from: 'host',
        mode: 'audio',
        conversation_id: 'g1',
        members: [{ user_id: 'host' }, { user_id: 'me' }],
      },
      { user: { user_id: 'me' }, t, toast, setGroupCallState },
    );

    expect(setGroupCallState).toHaveBeenCalledWith(expect.objectContaining({
      mediaMode: 'sfu',
      direction: 'incoming',
      conversationId: 'g1',
    }));
  });
});