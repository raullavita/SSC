/**
 * Group Sender Keys — Engine 8.11 (signal_group_v1).
 */
import { api } from '../api';
import { ProtocolVersion, SKDM_MESSAGE_TYPE, SignalMessageType } from './constants';
import {
  createGroupSenderKeyDistribution,
  decryptGroupMessage as nativeDecryptGroup,
  encryptGroupMessage as nativeEncryptGroup,
  hasGroupSenderKey,
  isNativeLibsignalAvailable,
  processGroupSenderKeyDistribution,
} from './nativeLibsignal';
import { encryptSignalText } from './messages';
import { canUseSignalMessaging } from './messages';
import { ensureSignalSession } from './x3dh';

const SKDM_ENVELOPE_TYPE = 'ssc_skdm';
const SKDM_SENT_PREFIX = 'ssc_skdm_sent:';

export function isSignalGroupV1Message(msg) {
  return (msg?.protocol || ProtocolVersion.LEGACY_RSA) === ProtocolVersion.SIGNAL_GROUP_V1;
}

/** Stable opaque group sender-key id from conversation_id. */
export async function distributionIdForConversation(conversationId) {
  const data = new TextEncoder().encode(`ssc-group:${conversationId}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function skdmSentKey(conversationId) {
  return `${SKDM_SENT_PREFIX}${conversationId}`;
}

function getSkdmSentSet(conversationId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(skdmSentKey(conversationId)) || '[]'));
  } catch {
    return new Set();
  }
}

function markSkdmSent(conversationId, memberId) {
  const sent = getSkdmSentSet(conversationId);
  sent.add(memberId);
  localStorage.setItem(skdmSentKey(conversationId), JSON.stringify([...sent]));
}

export function buildSkdmEnvelope({ conversationId, distributionId, fromUserId, skdm }) {
  return JSON.stringify({
    t: SKDM_ENVELOPE_TYPE,
    v: 1,
    cid: conversationId,
    dist: distributionId,
    from: fromUserId,
    skdm,
  });
}

export function parseSkdmEnvelope(plaintext) {
  try {
    const obj = JSON.parse(plaintext || '{}');
    if (obj?.t !== SKDM_ENVELOPE_TYPE || !obj?.skdm || !obj?.from) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function canUseSignalGroupMessaging(members, ourUserId, user) {
  if (!isNativeLibsignalAvailable() || !user?.signal_prekeys_ready) return false;
  if (!members || members.length < 2) return false;
  for (const m of members) {
    if (m.user_id === ourUserId) continue;
    if (m.signal_prekeys_ready === false) return false;
    const ready = await canUseSignalMessaging(m.user_id, ourUserId, true);
    if (!ready) return false;
  }
  return true;
}

async function fanOutSkdm({ conversationId, distributionId, skdm, members, ourUserId }) {
  const sent = getSkdmSentSet(conversationId);
  const targets = members.filter((m) => m.user_id !== ourUserId && !sent.has(m.user_id));
  for (const member of targets) {
    await ensureSignalSession(member.user_id, ourUserId);
    const envelope = buildSkdmEnvelope({
      conversationId,
      distributionId,
      fromUserId: ourUserId,
      skdm,
    });
    const enc = await encryptSignalText(member.user_id, ourUserId, envelope);
    await api.post('/messages', {
      conversation_id: conversationId,
      protocol: ProtocolVersion.SIGNAL_V1,
      ciphertext: enc.ciphertext,
      signal_message_type: enc.signal_message_type,
      message_type: SKDM_MESSAGE_TYPE,
      distribution_id: distributionId,
    });
    markSkdmSent(conversationId, member.user_id);
  }
}

export async function ensureGroupSenderKeysDistributed({ conversationId, members, ourUserId }) {
  const distributionId = await distributionIdForConversation(conversationId);
  const sent = getSkdmSentSet(conversationId);
  const pending = members.filter((m) => m.user_id !== ourUserId && !sent.has(m.user_id));
  if (pending.length === 0) {
    return distributionId;
  }
  const { skdm } = await createGroupSenderKeyDistribution(ourUserId, distributionId);
  await fanOutSkdm({ conversationId, distributionId, skdm, members, ourUserId });
  return distributionId;
}

export async function processIncomingSkdmMessage(msg, { myUserId, peerUserId }) {
  if (msg?.message_type !== SKDM_MESSAGE_TYPE) return false;
  if ((msg?.protocol || ProtocolVersion.LEGACY_RSA) !== ProtocolVersion.SIGNAL_V1) return false;
  const remoteId = msg.sender_id === myUserId ? peerUserId : msg.sender_id;
  if (!remoteId) return false;
  const { decryptSignalText } = await import('./messages');
  const plaintext = await decryptSignalText(remoteId, myUserId, msg);
  const envelope = parseSkdmEnvelope(plaintext);
  if (!envelope) return false;
  await processGroupSenderKeyDistribution(envelope.from, envelope.skdm);
  return true;
}

export async function encryptGroupText(conversationId, ourUserId, plaintext) {
  const distributionId = await distributionIdForConversation(conversationId);
  return nativeEncryptGroup(ourUserId, distributionId, plaintext ?? '');
}

export async function decryptGroupText(senderUserId, msg) {
  if (!isSignalGroupV1Message(msg)) {
    throw new Error('not a signal_group_v1 message');
  }
  const result = await nativeDecryptGroup(senderUserId, msg.ciphertext);
  return result?.plaintext ?? '';
}

export async function memberHasOurSenderKey(memberUserId, conversationId) {
  const distributionId = await distributionIdForConversation(conversationId);
  const status = await hasGroupSenderKey(memberUserId, distributionId);
  return !!status?.has_sender_key;
}

export { SignalMessageType };