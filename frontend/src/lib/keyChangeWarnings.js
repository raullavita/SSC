/**
 * Key-change warnings — Q.53 (prominent alert when a contact's identity key changes).
 */
import { identityStorageFingerprint, resolveUserIdentity } from './identityKey';
import { clearPeerVerification } from './verification';

export const TRUSTED_IDENTITY_PREFIX = 'ssc_trusted_identity_';
export const KEY_CHANGE_EVENT = 'ssc-key-change';

export function trustedIdentityStorageKey(peerUserId) {
  return `${TRUSTED_IDENTITY_PREFIX}${peerUserId}`;
}

export function getPeerIdentityFingerprint(peer) {
  const identity = resolveUserIdentity(peer);
  if (!identity) return null;
  return identityStorageFingerprint(identity);
}

export function getTrustedIdentityFingerprint(peerUserId) {
  if (typeof localStorage === 'undefined' || !peerUserId) return null;
  return localStorage.getItem(trustedIdentityStorageKey(peerUserId));
}

export function setTrustedIdentityFingerprint(peerUserId, fingerprint) {
  if (typeof localStorage === 'undefined' || !peerUserId || !fingerprint) return;
  localStorage.setItem(trustedIdentityStorageKey(peerUserId), fingerprint);
}

export function seedTrustedIdentityIfMissing(peer) {
  const fp = getPeerIdentityFingerprint(peer);
  if (!fp || !peer?.user_id) return;
  if (!getTrustedIdentityFingerprint(peer.user_id)) {
    setTrustedIdentityFingerprint(peer.user_id, fp);
  }
}

export function isPeerIdentityChanged(peer) {
  if (!peer?.user_id) return false;
  const current = getPeerIdentityFingerprint(peer);
  const trusted = getTrustedIdentityFingerprint(peer.user_id);
  if (!current || !trusted) return false;
  return current !== trusted;
}

export function acknowledgePeerIdentity(peer) {
  const fp = getPeerIdentityFingerprint(peer);
  if (!peer?.user_id || !fp) return;
  setTrustedIdentityFingerprint(peer.user_id, fp);
  dispatchKeyChangeEvent(peer.user_id, false);
}

export function handlePeerIdentityRotation(peerUserId) {
  if (!peerUserId) return;
  clearPeerVerification(peerUserId);
  dispatchKeyChangeEvent(peerUserId, true);
}

export function dispatchKeyChangeEvent(peerUserId, active) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(KEY_CHANGE_EVENT, {
    detail: { peerUserId, active },
  }));
}

export function purgeTrustedIdentitiesOnPanic() {
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(TRUSTED_IDENTITY_PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}