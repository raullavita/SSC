/**
 * Incoming WebRTC signaling unpack with explicit errors.
 * Installed clients reject cleartext SDP/ICE downgrade.
 */
import { usesSignalOnlyMessaging } from '../lib/signal/installedMessaging';
import {
  getSignalingProtocol,
  isEncryptedSignaling,
  SignalingProtocol,
  unpackIncomingSignaling,
} from '../lib/signal/webrtcSignaling';

export const SignalingInboundError = {
  NO_SDP: 'no_sdp',
  DECRYPT_FAILED: 'decrypt_failed',
  CLEARTEXT_REJECTED: 'cleartext_rejected',
};

function isCleartextSignalingPayload(data) {
  if (data?.sdp != null || data?.candidate != null) return true;
  return getSignalingProtocol(data) === SignalingProtocol.LEGACY_CLEARTEXT;
}

/**
 * @returns {Promise<{ ok: true, signal: object } | { ok: false, error: string, encrypted: boolean }>}
 */
export async function resolveIncomingSignaling(data, { myUserId, peerUserId }) {
  if (!data) {
    return { ok: false, error: SignalingInboundError.NO_SDP, encrypted: false };
  }

  if (data?.group && isCleartextSignalingPayload(data)) {
    console.warn('[SSC] rejected cleartext inbound group call signaling');
    return { ok: false, error: SignalingInboundError.CLEARTEXT_REJECTED, encrypted: false };
  }

  if (usesSignalOnlyMessaging() && isCleartextSignalingPayload(data)) {
    console.warn('[SSC] rejected cleartext inbound signaling on installed client');
    return { ok: false, error: SignalingInboundError.CLEARTEXT_REJECTED, encrypted: false };
  }

  if (data.sdp != null || data.candidate != null) {
    return { ok: true, signal: data };
  }

  if (!isEncryptedSignaling(data)) {
    return { ok: false, error: SignalingInboundError.NO_SDP, encrypted: false };
  }

  try {
    const signal = await unpackIncomingSignaling(data, { myUserId, peerUserId });
    if (signal?.sdp == null && signal?.candidate == null) {
      return { ok: false, error: SignalingInboundError.NO_SDP, encrypted: true };
    }
    return { ok: true, signal };
  } catch (err) {
    console.warn('[SSC] encrypted signaling unpack failed:', err?.message || err);
    return { ok: false, error: SignalingInboundError.DECRYPT_FAILED, encrypted: true };
  }
}