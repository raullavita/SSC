/**
 * WebRTC signaling encryption — Engine 8.7 + TASK O.2.
 * 1:1 and group SDP/ICE wrapped in Signal ciphertext when sessions/sender-keys are ready.
 */
import { ProtocolVersion } from './constants';
// SIGNAL_GROUP_V1 used for group signaling decrypt shim
import {
  canUseSignalGroupMessaging,
  ensureGroupSenderKeysDistributed,
  encryptGroupText,
  decryptGroupText,
} from './groupMessages';
import { encryptSignalText, decryptSignalText, canUseSignalMessaging } from './messages';
import { isNativeLibsignalAvailable } from './nativeLibsignal';

export const SignalingProtocol = {
  LEGACY_CLEARTEXT: 'legacy_cleartext',
  SIGNAL_V1: 'signal_v1',
};

const SENSITIVE_TYPES = new Set(['call-offer', 'call-answer', 'ice-candidate']);

export function getSignalingProtocol(msg) {
  return msg?.signaling_protocol || SignalingProtocol.LEGACY_CLEARTEXT;
}

export function isEncryptedSignaling(msg) {
  return getSignalingProtocol(msg) === SignalingProtocol.SIGNAL_V1;
}

/** Remote peer for ratchet lookup on incoming WS payloads. */
export function signalingRemoteUserId(msg, { myUserId, peerUserId }) {
  if (msg?.from && msg.from !== myUserId) return msg.from;
  return peerUserId;
}

export async function shouldEncryptSignaling({ isGroup, peer, user, members, conversationId }) {
  if (!user?.user_id) return false;
  if (!isNativeLibsignalAvailable()) return false;
  if (!user.signal_prekeys_ready) return false;
  if (isGroup) {
    if (!conversationId || !members?.length) return false;
    return canUseSignalGroupMessaging(members, user.user_id, user);
  }
  if (!peer?.user_id || !peer.signal_prekeys_ready) return false;
  return canUseSignalMessaging(peer.user_id, user.user_id, true);
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

  const useSignal = await shouldEncryptSignaling({
    isGroup, peer, user, members, conversationId,
  });
  if (!useSignal) {
    const legacy = { ...msg, signaling_protocol: SignalingProtocol.LEGACY_CLEARTEXT };
    if (isGroup) legacy.group = true;
    return legacy;
  }

  const inner = buildInnerPayload(msg);
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
  if (!socket?.send) return;
  const packed = await packOutgoingSignaling(msg, ctx);
  socket.send(packed);
}