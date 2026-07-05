/**
 * Safety number verification — libsignal Fingerprint — Engine 13 + P2#13.
 */

import { api } from '../lib/api';
import { numericFingerprintDisplayable } from './numericFingerprint';

export async function fetchPeerIdentityKey(peerId, deviceId = '1') {
  const data = await api.get(`/api/prekeys/users/${peerId}/devices/${deviceId}`);
  const bundle = data.bundle || data;
  return bundle.identity_key || bundle.identityKey;
}

export async function fetchLocalIdentityKey(userId, deviceId = '1') {
  const data = await api.get(`/api/prekeys/users/${userId}/devices/${deviceId}`);
  const bundle = data.bundle || data;
  return bundle.identity_key || bundle.identityKey;
}

export async function computeSafetyNumber(peerId, deviceId = '1', localUserId = null) {
  const identityKey = await fetchPeerIdentityKey(peerId, deviceId);
  if (window.sscCrypto?.computeSafetyNumber) {
    const result = await window.sscCrypto.computeSafetyNumber(peerId, identityKey);
    return { ...result, deviceId, mode: 'native' };
  }

  const localId = localUserId || (await api.get('/api/auth/me')).id;
  const localKey = await fetchLocalIdentityKey(localId, deviceId);
  const displayable = await numericFingerprintDisplayable({
    localUserId: localId,
    remoteUserId: peerId,
    localIdentityKeyB64: localKey,
    remoteIdentityKeyB64: identityKey,
  });
  return {
    displayable,
    localUser: localId,
    peerId,
    deviceId,
    mode: 'dev-fingerprint',
  };
}

export function trustStoreKey(peerId, deviceId = '1') {
  return `${peerId}:${deviceId}`;
}