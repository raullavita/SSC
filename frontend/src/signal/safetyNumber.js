/**
 * Safety number verification — libsignal Fingerprint — Engine 13.
 */

import { api } from '../lib/api';

export async function fetchPeerIdentityKey(peerId, deviceId = '1') {
  const data = await api.get(`/api/prekeys/users/${peerId}/devices/${deviceId}`);
  const bundle = data.bundle || data;
  return bundle.identity_key || bundle.identityKey;
}

export async function computeSafetyNumber(peerId, deviceId = '1') {
  const identityKey = await fetchPeerIdentityKey(peerId, deviceId);
  if (window.sscCrypto?.computeSafetyNumber) {
    return window.sscCrypto.computeSafetyNumber(peerId, identityKey);
  }
  // Dev fallback: hash display only (not cryptographic verification).
  const raw = `${peerId}:${identityKey?.slice(0, 24) || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) % 1000000007;
  }
  const groups = String(hash).padStart(12, '0').match(/.{1,4}/g) || [];
  return { displayable: groups.join(' '), localUser: 'dev', peerId, mode: 'dev' };
}