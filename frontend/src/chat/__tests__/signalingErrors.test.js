const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('sonner', () => ({
  toast: { error: jest.fn() },
}));

const { toast } = require('sonner');
const {
  serverSignalingErrorI18nKey,
  toastServerSignalingError,
} = require('../signalingErrors');

describe('signalingErrors', () => {
  const t = jest.fn((key) => key);

  beforeEach(() => {
    jest.clearAllMocks();
    t.mockImplementation((key) => key);
  });

  it('maps permission denied to callSignalingNotPermitted', () => {
    expect(serverSignalingErrorI18nKey('call not permitted')).toBe('callSignalingNotPermitted');
  });

  it('maps missing recipient to callSignalingRecipientRequired', () => {
    expect(serverSignalingErrorI18nKey('recipient required')).toBe('callSignalingRecipientRequired');
  });

  it('maps encryption failures to callSignalingEncryptFailed', () => {
    expect(serverSignalingErrorI18nKey('group call signaling must use signal_v1 encryption')).toBe(
      'callSignalingEncryptFailed',
    );
  });

  it('falls back to callSignalingRejected for unknown detail', () => {
    expect(serverSignalingErrorI18nKey('something else')).toBe('callSignalingRejected');
  });

  it('toastServerSignalingError uses mapped key without leaking raw detail', () => {
    toastServerSignalingError({ detail: 'call not permitted', original_type: 'call-offer' }, t);
    expect(t).toHaveBeenCalledWith('callSignalingNotPermitted');
    expect(toast.error).toHaveBeenCalledWith('callSignalingNotPermitted');
  });
});