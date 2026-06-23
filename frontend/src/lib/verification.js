/**
 * Verification handshake — Engine 2 Step 2.6.
 * Verified state is bound to the canonical safety number and both public-key fingerprints.
 * Legacy `ssc_verified_{user_id}=1` flags are rejected and purged on startup.
 */
import { publicKeyFingerprint } from './crypto';

export const VERIFICATION_STORAGE_V2_PREFIX = 'ssc_verified_v2_';
export const LEGACY_VERIFICATION_PREFIX = 'ssc_verified_';
export const VERIFICATION_RECORD_VERSION = 1;

function normalizeFingerprintHex(fp) {
  return (fp || '').replace(/\s/g, '').toUpperCase();
}

export async function computeSafetyNumber(myPubJwk, peerPubJwk) {
  const a = await publicKeyFingerprint(myPubJwk);
  const b = await publicKeyFingerprint(peerPubJwk);
  const [first, second] = normalizeFingerprintHex(a) < normalizeFingerprintHex(b) ? [a, b] : [b, a];
  const combined = (normalizeFingerprintHex(first) + normalizeFingerprintHex(second)).slice(0, 60);
  const blocks = [];
  for (let i = 0; i < 60; i += 5) blocks.push(combined.slice(i, i + 5));
  return { display: blocks.join(' '), canonical: combined };
}

export function verificationStorageKey(peerUserId) {
  return `${VERIFICATION_STORAGE_V2_PREFIX}${peerUserId}`;
}

export async function markPeerVerified(peerUserId, myPubJwk, peerPubJwk) {
  const myFp = normalizeFingerprintHex(await publicKeyFingerprint(myPubJwk));
  const peerFp = normalizeFingerprintHex(await publicKeyFingerprint(peerPubJwk));
  const { canonical } = await computeSafetyNumber(myPubJwk, peerPubJwk);
  const record = {
    v: VERIFICATION_RECORD_VERSION,
    safety_number: canonical,
    peer_fingerprint: peerFp,
    my_fingerprint: myFp,
    verified_at: new Date().toISOString(),
  };
  localStorage.setItem(verificationStorageKey(peerUserId), JSON.stringify(record));
  localStorage.removeItem(`${LEGACY_VERIFICATION_PREFIX}${peerUserId}`);
  window.dispatchEvent(new Event('ssc-verified-change'));
  return record;
}

export async function isPeerVerified(peerUserId, myPubJwk, peerPubJwk) {
  if (!peerUserId || !myPubJwk || !peerPubJwk) return false;

  const legacy = localStorage.getItem(`${LEGACY_VERIFICATION_PREFIX}${peerUserId}`);
  if (legacy === '1') return false;

  const raw = localStorage.getItem(verificationStorageKey(peerUserId));
  if (!raw) return false;

  try {
    const record = JSON.parse(raw);
    if (record.v !== VERIFICATION_RECORD_VERSION || !record.safety_number) return false;

    const myFp = normalizeFingerprintHex(await publicKeyFingerprint(myPubJwk));
    const peerFp = normalizeFingerprintHex(await publicKeyFingerprint(peerPubJwk));
    const { canonical } = await computeSafetyNumber(myPubJwk, peerPubJwk);

    return (
      record.safety_number === canonical
      && record.peer_fingerprint === peerFp
      && record.my_fingerprint === myFp
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

/** Remove pre-2.6 boolean flags (`ssc_verified_*` = `1`). */
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

/**
 * Remove all peer verification records — panic only (logout keeps trust flags).
 * Clears v2 crypto-bound records and any legacy boolean flags.
 */
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