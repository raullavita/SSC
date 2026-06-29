import { toast } from 'sonner';
import { SignalingNotReadyError, signalingErrorI18nKey } from '../lib/signal/webrtcSignaling';

/** Map server signaling-error detail to a safe user-facing i18n key (no raw server text in UI). */
export function serverSignalingErrorI18nKey(detail) {
  const d = String(detail || '').toLowerCase();
  if (d.includes('not permitted')) return 'callSignalingNotPermitted';
  if (d.includes('recipient required')) return 'callSignalingRecipientRequired';
  if (d.includes('signal_v1') || d.includes('encryption') || d.includes('ciphertext')) {
    return 'callSignalingEncryptFailed';
  }
  return 'callSignalingRejected';
}

/** @returns {boolean} true when error was handled */
export function toastSignalingFailure(err, t) {
  if (!(err instanceof SignalingNotReadyError)) return false;
  const key = signalingErrorI18nKey(err.reason);
  console.warn('[SSC] outbound signaling blocked:', err.reason, err.detail || '');
  toast.error(t(key));
  return true;
}

/** Handle inbound WS signaling-error from the server. */
export function toastServerSignalingError(data, t) {
  const key = serverSignalingErrorI18nKey(data?.detail);
  console.warn('[SSC] signaling rejected by server:', data?.detail || data?.original_type);
  toast.error(t(key));
}