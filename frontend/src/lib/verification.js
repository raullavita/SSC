/**
 * Verification handshake — Engine 2.6 + Engine 8.2 (safety numbers v3).
 * Verified state is bound to canonical safety number and identity fingerprints.
 */
import { resolveUserIdentity, identityStorageFingerprint } from './identityKey';
import {
  computeSafetyNumberV3,
  normalizeSafetyNumberInput,
} from './safetyNumber';

export const VERIFICATION_STORAGE_V2_PREFIX = 'ssc_verified_v2_';
export const LEGACY_VERIFICATION_PREFIX = 'ssc_verified_';
export const VERIFICATION_RECORD_VERSION = 3;

function parsePublicKeyJwk(publicKeyField) {
  return resolveUserIdentity({ public_key: publicKeyField })?.jwk
    || (typeof publicKeyField === 'object' ? publicKeyField : null);
}

/** @deprecated Use computeSafetyNumberForUsers */
export async function computeSafetyNumber(myPubJwk, peerPubJwk) {
  return computeSafetyNumberForUsers(
    { public_key: myPubJwk },
    'local',
    { public_key: peerPubJwk },
    'peer',
  );
}

export async function computeSafetyNumberForUsers(me, myUserId, peer, peerUserId) {
  const myIdentity = resolveUserIdentity(me);
  const peerIdentity = resolveUserIdentity(peer);
  if (!myIdentity || !peerIdentity) {
    throw new Error('missing identity keys');
  }
  return computeSafetyNumberV3(myIdentity, myUserId, peerIdentity, peerUserId);
}

export function verificationStorageKey(peerUserId) {
  return `${VERIFICATION_STORAGE_V2_PREFIX}${peerUserId}`;
}

async function buildVerificationRecord(peerUserId, me, myUserId, peer) {
  const myIdentity = resolveUserIdentity(me);
  const peerIdentity = resolveUserIdentity(peer);
  const { canonical, keyType } = await computeSafetyNumberForUsers(me, myUserId, peer, peerUserId);
  return {
    v: VERIFICATION_RECORD_VERSION,
    key_type: keyType,
    safety_number: canonical,
    peer_identity: identityStorageFingerprint(peerIdentity),
    my_identity: identityStorageFingerprint(myIdentity),
    verified_at: new Date().toISOString(),
  };
}

export async function markPeerVerified(peerUserId, meOrMyPub, peerOrPeerPub, myUserId, peerUser) {
  let me = meOrMyPub;
  let peer = peerOrPeerPub;
  let myId = myUserId;
  let peerId = peerUser?.user_id || peerUserId;

  if (!myUserId && meOrMyPub?.n) {
    me = { public_key: meOrMyPub };
    peer = { public_key: peerOrPeerPub };
    myId = 'local';
    peerId = peerUserId;
  }

  const record = await buildVerificationRecord(peerId, me, myId, peer);
  // codeql[js/clear-text-storage-of-sensitive-information]: public identity fingerprints for verify state — not credentials
  localStorage.setItem(verificationStorageKey(peerId), JSON.stringify(record));
  localStorage.removeItem(`${LEGACY_VERIFICATION_PREFIX}${peerId}`);
  window.dispatchEvent(new Event('ssc-verified-change'));
  return record;
}

export async function isPeerVerified(peerUserId, meOrMyPub, peerOrPeerPub, myUserId, peerUser) {
  let me = meOrMyPub;
  let peer = peerOrPeerPub;
  let myId = myUserId;
  let peerId = peerUser?.user_id || peerUserId;

  if (!myUserId && meOrMyPub?.n) {
    me = { public_key: meOrMyPub };
    peer = { public_key: peerOrPeerPub };
    myId = 'local';
    peerId = peerUserId;
  }

  if (!peerId || !me || !peer) return false;

  const legacy = localStorage.getItem(`${LEGACY_VERIFICATION_PREFIX}${peerId}`);
  if (legacy === '1') return false;

  const raw = localStorage.getItem(verificationStorageKey(peerId));
  if (!raw) return false;

  try {
    const record = JSON.parse(raw);
    if (!record.safety_number) return false;
    if (record.v !== VERIFICATION_RECORD_VERSION) return false;

    const myIdentity = resolveUserIdentity(me);
    const peerIdentity = resolveUserIdentity(peer);
    const { canonical } = await computeSafetyNumberForUsers(me, myId, peer, peerId);

    return (
      normalizeSafetyNumberInput(record.safety_number) === canonical
      && record.peer_identity === identityStorageFingerprint(peerIdentity)
      && record.my_identity === identityStorageFingerprint(myIdentity)
      && record.key_type === myIdentity.type
    );
  } catch {
    return false;
  }
}

export function clearPeerVerification(peerUserId) {
  localStorage.removeItem(verificationStorageKey(peerUserId));
  localStorage.removeItem(`${LEGACY_VERIFICATION_PREFIX}${peerUserId}`);
  window.dispatchEvent(new Event('ssc-verified-change'));
}

export function purgeLegacyVerificationFlags() {
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LEGACY_VERIFICATION_PREFIX)) continue;
    if (key.startsWith(VERIFICATION_STORAGE_V2_PREFIX)) continue;
    keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}

export function purgeVerificationStorageOnPanic() {
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(VERIFICATION_STORAGE_V2_PREFIX)) keys.push(key);
    else if (key.startsWith(LEGACY_VERIFICATION_PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
  if (keys.length) window.dispatchEvent(new Event('ssc-verified-change'));
}