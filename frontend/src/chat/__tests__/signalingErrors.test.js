import { toast } from 'sonner';
import {
  serverSignalingErrorI18nKey,
  toastServerSignalingError,
} from '../signalingErrors';

jest.mock('sonner', () => ({
  toast: { error: jest.fn() },
}));

describe('signalingErrors', () => {
  const t = jest.fn((key) => key);

  beforeEach(() => {
    jest.clearAllMocks();
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