/**
 * WebRTC signaling encryption — Engine 8.7 + TASK O.2.
 * 1:1 and group SDP/ICE wrapped in Signal ciphertext when sessions/sender-keys are ready.
 */
import { ProtocolVersion } from './constants';
import {
  canUseSignalGroupMessaging,
  ensureGroupSenderKeysDistributed,
  encryptGroupText,
  decryptGroupText,
} from './groupMessages';
import { encryptSignalText, decryptSignalText, canUseSignalMessaging } from './messages';
import { ensureSignalSession } from './x3dh';
import { isNativeLibsignalAvailable } from './nativeLibsignal';
import { usesSignalOnlyMessaging } from './installedMessaging';

export const SignalingProtocol = {
  LEGACY_CLEARTEXT: 'legacy_cleartext',
  SIGNAL_V1: 'signal_v1',
};

export const SignalingFailureReason = {
  NO_USER: 'no_user',
  LIBSIGNAL_UNAVAILABLE: 'libsignal_unavailable',
  SELF_PREKEYS_NOT_READY: 'self_prekeys_not_ready',
  PEER_PREKEYS_NOT_READY: 'peer_prekeys_not_ready',
  SESSION_ESTABLISH_FAILED: 'session_establish_failed',
  GROUP_NOT_READY: 'group_not_ready',
  ENCRYPT_FAILED: 'encrypt_failed',
  NO_SOCKET: 'no_socket',
};

export class SignalingNotReadyError extends Error {
  constructor(reason, detail) {
    super(detail || reason);
    this.name = 'SignalingNotReadyError';
    this.reason = reason;
    this.detail = detail;
  }
}

const SENSITIVE_TYPES = new Set(['call-offer', 'call-answer', 'ice-candidate']);

export function getSignalingProtocol(msg) {
  return msg?.signaling_protocol || SignalingProtocol.LEGACY_CLEARTEXT;
}

export function isEncryptedSignaling(msg) {
  return getSignalingProtocol(msg) === SignalingProtocol.SIGNAL_V1;
}

export function signalingErrorI18nKey(reason) {
  switch (reason) {
    case SignalingFailureReason.LIBSIGNAL_UNAVAILABLE:
      return 'encryptionErrLibsignal';
    case SignalingFailureReason.SELF_PREKEYS_NOT_READY:
      return 'encryptionErrSelfPrekeys';
    case SignalingFailureReason.PEER_PREKEYS_NOT_READY:
      return 'encryptionErrPeerPrekeys';
    case SignalingFailureReason.SESSION_ESTABLISH_FAILED:
      return 'encryptionErrSession';
    case SignalingFailureReason.GROUP_NOT_READY:
      return 'encryptionErrGroup';
    case SignalingFailureReason.ENCRYPT_FAILED:
      return 'callSignalingEncryptFailed';
    default:
      return 'callSignalingEncryptFailed';
  }
}

/** Remote peer for ratchet lookup on incoming WS payloads. */
export function signalingRemoteUserId(msg, { myUserId, peerUserId }) {
  if (msg?.from && msg.from !== myUserId) return msg.from;
  return peerUserId;
}

/**
 * Resolve whether outbound signaling must use Signal encryption.
 * Installed clients: throws SignalingNotReadyError instead of silent cleartext downgrade.
 * @returns {Promise<boolean>} true when Signal encryption is required and ready
 */
export async function shouldEncryptSignaling({ isGroup, peer, user, members, conversationId }) {
  return assertSignalingReady({ isGroup, peer, user, members, conversationId });
}

async function assertSignalingReady({ isGroup, peer, user, members, conversationId }) {
  const signalRequired = usesSignalOnlyMessaging();

  if (!user?.user_id) {
    if (signalRequired) throw new SignalingNotReadyError(SignalingFailureReason.NO_USER);
    return false;
  }
  if (!isNativeLibsignalAvailable()) {
    if (signalRequired) throw new SignalingNotReadyError(SignalingFailureReason.LIBSIGNAL_UNAVAILABLE);
    return false;
  }
  if (!user.signal_prekeys_ready) {
    if (signalRequired) throw new SignalingNotReadyError(SignalingFailureReason.SELF_PREKEYS_NOT_READY);
    return false;
  }

  if (isGroup) {
    if (!conversationId || !members?.length) {
      if (signalRequired) throw new SignalingNotReadyError(SignalingFailureReason.GROUP_NOT_READY);
      return false;
    }
    const ok = canUseSignalGroupMessaging(members, user.user_id, user);
    if (!ok) {
      if (signalRequired) throw new SignalingNotReadyError(SignalingFailureReason.GROUP_NOT_READY);
      return false;
    }
    return true;
  }

  if (!peer?.user_id || peer.signal_prekeys_ready === false) {
    if (signalRequired) {
      throw new SignalingNotReadyError(SignalingFailureReason.PEER_PREKEYS_NOT_READY);
    }
    return false;
  }

  try {
    await ensureSignalSession(peer.user_id, user.user_id);
  } catch (err) {
    if (signalRequired) {
      throw new SignalingNotReadyError(
        SignalingFailureReason.SESSION_ESTABLISH_FAILED,
        err?.message || String(err),
      );
    }
    return false;
  }

  const canUse = await canUseSignalMessaging(peer.user_id, user.user_id, true);
  if (!canUse) {
    if (signalRequired) {
      throw new SignalingNotReadyError(SignalingFailureReason.SESSION_ESTABLISH_FAILED);
    }
    return false;
  }
  return true;
}

function buildInnerPayload(msg) {
  const inner = {};
  if (msg.sdp != null) inner.sdp = msg.sdp;
  if (msg.candidate != null) inner.candidate = msg.candidate;
  return inner;
}

/** Pack outgoing WS signaling — encrypts sdp/candidate for 1:1 when session ready. */
export async function packOutgoingSignaling(msg, {
  peerUserId, ourUserId, peer, user, isGroup = false, members, conversationId,
}) {
  if (!SENSITIVE_TYPES.has(msg?.type)) {
    return msg;
  }

  const useSignal = await assertSignalingReady({
    isGroup, peer, user, members, conversationId,
  });
  if (!useSignal) {
    if (isGroup) {
      throw new SignalingNotReadyError(SignalingFailureReason.GROUP_NOT_READY);
    }
    return legacySignalingPayload(msg, isGroup);
  }

  const inner = buildInnerPayload(msg);
  try {
    let enc;
    if (isGroup) {
      await ensureGroupSenderKeysDistributed({
        conversationId,
        members: [...(members || []), { user_id: ourUserId }],
        ourUserId,
      });
      enc = await encryptGroupText(conversationId, ourUserId, JSON.stringify(inner));
      const packed = {
        type: msg.type,
        to: msg.to,
        group: true,
        signaling_protocol: SignalingProtocol.SIGNAL_V1,
        signaling_ciphertext: enc.ciphertext,
        signal_message_type: enc.signal_message_type,
        distribution_id: enc.distribution_id,
      };
      if (msg.mode != null) packed.mode = msg.mode;
      if (msg.members != null) packed.members = msg.members;
      if (msg.renegotiate) packed.renegotiate = true;
      if (msg.ice_restart) packed.ice_restart = true;
      if (msg.conversation_id != null) packed.conversation_id = msg.conversation_id;
      return packed;
    }

    enc = await encryptSignalText(peerUserId, ourUserId, JSON.stringify(inner));
    const packed = {
      type: msg.type,
      to: msg.to,
      signaling_protocol: SignalingProtocol.SIGNAL_V1,
      signaling_ciphertext: enc.ciphertext,
      signal_message_type: enc.signal_message_type,
    };
    if (msg.mode != null) packed.mode = msg.mode;
    return packed;
  } catch (err) {
    console.error('[SSC] signaling encrypt failed:', err?.message || err);
    if (isGroup || usesSignalOnlyMessaging()) {
      throw new SignalingNotReadyError(
        SignalingFailureReason.ENCRYPT_FAILED,
        err?.message || String(err),
      );
    }
    console.warn('[SSC] signaling encrypt failed — falling back to legacy cleartext');
    return legacySignalingPayload(msg, isGroup);
  }
}

function legacySignalingPayload(msg, isGroup) {
  const legacy = { ...msg, signaling_protocol: SignalingProtocol.LEGACY_CLEARTEXT };
  if (isGroup) legacy.group = true;
  return legacy;
}

/** Unpack incoming WS signaling — decrypts signal_v1 inner sdp/candidate. */
export async function unpackIncomingSignaling(msg, { myUserId, peerUserId }) {
  if (!msg || !SENSITIVE_TYPES.has(msg.type)) {
    return msg;
  }

  const proto = getSignalingProtocol(msg);
  if (proto !== SignalingProtocol.SIGNAL_V1) {
    return msg;
  }
  if (msg.sdp != null || msg.candidate != null) {
    return msg;
  }
  if (!msg.signaling_ciphertext) {
    throw new Error('NO_SIGNALING_CIPHERTEXT');
  }

  const remoteId = signalingRemoteUserId(msg, { myUserId, peerUserId });
  if (!remoteId || !myUserId) throw new Error('NO_PEER');

  let plaintext;
  if (msg.group) {
    plaintext = await decryptGroupText(remoteId, {
      protocol: ProtocolVersion.SIGNAL_GROUP_V1,
      ciphertext: msg.signaling_ciphertext,
      signal_message_type: msg.signal_message_type,
      sender_id: remoteId,
    });
  } else {
    plaintext = await decryptSignalText(remoteId, myUserId, {
      protocol: ProtocolVersion.SIGNAL_V1,
      ciphertext: msg.signaling_ciphertext,
      signal_message_type: msg.signal_message_type,
    });
  }
  const inner = JSON.parse(plaintext || '{}');
  return {
    ...msg,
    ...(inner.sdp != null ? { sdp: inner.sdp } : {}),
    ...(inner.candidate != null ? { candidate: inner.candidate } : {}),
  };
}

/** Send signaling through socket with optional ratchet wrapping. */
export async function sendSignaling(socket, msg, ctx) {
  if (!socket?.send) {
    throw new SignalingNotReadyError(SignalingFailureReason.NO_SOCKET);
  }
  const packed = await packOutgoingSignaling(msg, ctx);
  socket.send(packed);
}