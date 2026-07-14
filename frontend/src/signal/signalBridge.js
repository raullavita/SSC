/**
 * Signal crypto bridge — multi-device Sesame-style messaging.
 */

import { api } from '../lib/api';
import { getLocalDeviceId, getPrimaryDeviceId } from '../lib/deviceLink';
import {
  assertLibsignalRuntime,
  requiresProductionCrypto,
} from '../lib/cryptoPolicy';

import {
  SIGNAL_PROTOCOL_V1,
  buildDevSignalEnvelope,
  parseDevSignalEnvelope,
} from './envelope';

const SIGNED_PREKEY_ROTATE_MS = 7 * 24 * 60 * 60 * 1000;
const PREKEY_BATCH_COUNT = 50;

let libsignalModule = null;
let configuredLocalUserId = null;
let configuredLocalDeviceId = getPrimaryDeviceId();

/** Electron/Android libsignal bundles use camelCase; API expects snake_case. */
export function normalizePreKeyBundlePayload(deviceId, bundle) {
  const signed = bundle.signedPreKey || bundle.signed_prekey || {};
  const preKeys = bundle.preKeys || bundle.prekeys || [];
  const kyber = bundle.kyberPreKey || bundle.kyber_prekey || null;
  const payload = {
    device_id: String(deviceId),
    registration_id: bundle.registrationId ?? bundle.registration_id,
    identity_key: bundle.identityKey ?? bundle.identity_key,
    signed_prekey: {
      key_id: signed.keyId ?? signed.key_id,
      public_key: signed.publicKey ?? signed.public_key,
      signature: signed.signature,
    },
    prekeys: preKeys.map((pk) => ({
      key_id: pk.keyId ?? pk.key_id,
      public_key: pk.publicKey ?? pk.public_key,
    })),
  };
  if (kyber) {
    payload.kyber_prekey = {
      key_id: kyber.keyId ?? kyber.key_id,
      public_key: kyber.publicKey ?? kyber.public_key,
      signature: kyber.signature,
    };
  }
  return payload;
}

function signedPrekeyRotationKey(deviceId) {
  return `ssc_signed_prekey_rotated:${deviceId}`;
}

async function loadLibsignal() {
  if (libsignalModule) return libsignalModule;
  if (typeof window !== 'undefined' && window.sscCrypto?.encryptMessage) {
    libsignalModule = window.sscCrypto;
    return libsignalModule;
  }
  if (requiresProductionCrypto()) {
    return null;
  }
  try {
    const mod = await import('@signalapp/libsignal-client');
    libsignalModule = mod;
    return mod;
  } catch {
    return null;
  }
}

async function configureLocalIdentity(lib, { localUserId, deviceId } = {}) {
  const userId = localUserId || configuredLocalUserId;
  const devId = deviceId || configuredLocalDeviceId || getLocalDeviceId();
  if (!lib?.configure || !userId) return;
  configuredLocalUserId = userId;
  configuredLocalDeviceId = String(devId);
  await lib.configure({ localUserId: userId, deviceId: configuredLocalDeviceId });
}

export async function listPeerDevices(userId) {
  if (!userId) return [];
  const data = await api.get(`/api/prekeys/users/${userId}`);
  return data.devices || [];
}

async function ensurePeerSession(peerId, deviceId, { localUserId, localDeviceId } = {}) {
  const lib = await loadLibsignal();
  if (!peerId) throw new Error('peer_id_required');
  if (!lib?.establishSession) return;
  await configureLocalIdentity(lib, { localUserId, deviceId: localDeviceId });

  try {
    const data = await api.get(`/api/prekeys/users/${peerId}/devices/${deviceId}`);
    const bundle = data.bundle || data;
    await lib.establishSession(peerId, deviceId, bundle);
  } catch (err) {
    if (requiresProductionCrypto()) {
      const detail = err?.body?.detail || err?.message || 'unknown';
      if (detail === 'prekey_bundle_not_found') {
        throw new Error(
          'contact_prekeys_missing: Ask them to open SSC once so their encryption keys can register.'
        );
      }
      throw new Error(`libsignal_session_setup_failed:${detail}`);
    }
  }
}

export async function ensureAllPeerSessions(peerId, { localUserId, localDeviceId } = {}) {
  const devices = await listPeerDevices(peerId);
  const ids = devices.map((d) => String(d.device_id || d.deviceId || '1')).filter(Boolean);
  if (!ids.length) {
    await ensurePeerSession(peerId, '1', { localUserId, localDeviceId });
    return ['1'];
  }
  for (const deviceId of ids) {
    await ensurePeerSession(peerId, deviceId, { localUserId, localDeviceId });
  }
  return ids;
}

async function maybeReplenishPrekeys(lib, deviceId) {
  try {
    const status = await api.get(`/api/prekeys/status?device_id=${encodeURIComponent(deviceId)}`);
    if (!status.prekeys_low) return;
    const batch = lib.generatePreKeyBatchOnly
      ? await lib.generatePreKeyBatchOnly(PREKEY_BATCH_COUNT)
      : null;
    if (!batch?.preKeys?.length) return;
    await api.post('/api/prekeys/replenish', {
      device_id: deviceId,
      prekeys: batch.preKeys.map((pk) => ({
        key_id: pk.keyId ?? pk.key_id,
        public_key: pk.publicKey ?? pk.public_key,
      })),
    });
  } catch (err) {
    console.warn('[ssc] prekey replenish failed', err?.message || err);
  }
}

async function maybeRotateSignedPreKey(lib, deviceId) {
  const key = signedPrekeyRotationKey(deviceId);
  let last = 0;
  try {
    last = Number(localStorage.getItem(key) || 0);
  } catch {
    last = 0;
  }
  if (Date.now() - last < SIGNED_PREKEY_ROTATE_MS) return;
  if (!lib.rotateSignedPreKey) return;

  try {
    const rotated = await lib.rotateSignedPreKey();
    const signed = rotated.signedPreKey || rotated.signed_prekey;
    const kyber = rotated.kyberPreKey || rotated.kyber_prekey;
    const body = {
      device_id: deviceId,
      signed_prekey: {
        key_id: signed.keyId ?? signed.key_id,
        public_key: signed.publicKey ?? signed.public_key,
        signature: signed.signature,
      },
    };
    if (kyber) {
      body.kyber_prekey = {
        key_id: kyber.keyId ?? kyber.key_id,
        public_key: kyber.publicKey ?? kyber.public_key,
        signature: kyber.signature,
      };
    }
    await api.put('/api/prekeys/signed-prekey', body);
    localStorage.setItem(key, String(Date.now()));
  } catch (err) {
    console.warn('[ssc] signed prekey rotation failed', err?.message || err);
  }
}

export async function registerDeviceAndPrekeys({
  deviceId: inputDeviceId,
  deviceName,
  platform,
  localUserId,
}) {
  const deviceId = String(inputDeviceId || getLocalDeviceId());
  const lib = await loadLibsignal();
  assertLibsignalRuntime('register_prekeys');
  await configureLocalIdentity(lib, { localUserId, deviceId });

  if (!lib?.generatePreKeyBundle) {
    if (requiresProductionCrypto()) {
      throw new Error('libsignal_required:prekeys');
    }
    return { deviceId, prekeysUploaded: false, mode: 'dev' };
  }

  const bundle = lib.generatePreKeyBatch
    ? await lib.generatePreKeyBatch(PREKEY_BATCH_COUNT)
    : await lib.generatePreKeyBundle();

  await api.post('/api/devices', {
    device_id: deviceId,
    name: deviceName,
    platform,
  });
  const upload = await api.put('/api/prekeys/bundle', normalizePreKeyBundlePayload(deviceId, bundle));

  await maybeRotateSignedPreKey(lib, deviceId);
  if (upload?.prekeys_low) {
    await maybeReplenishPrekeys(lib, deviceId);
  }

  return { deviceId, prekeysUploaded: true, mode: 'libsignal', prekeysRemaining: upload?.prekeys_remaining };
}

export async function encryptMessageForRecipients(
  plaintext,
  {
    peerId,
    localUserId,
    localDeviceId = getLocalDeviceId(),
    includeSelfDevices = true,
    targetDeviceIds,
  } = {}
) {
  const lib = await loadLibsignal();
  if (!lib?.encryptMessage) {
    assertLibsignalRuntime('encrypt');
    const dev = buildDevSignalEnvelope(plaintext);
    return { device_ciphertexts: { '1': dev.ciphertext }, protocol: SIGNAL_PROTOCOL_V1 };
  }

  await configureLocalIdentity(lib, { localUserId, deviceId: localDeviceId });

  const deviceCiphertexts = {};
  const peerDevices = targetDeviceIds?.length
    ? targetDeviceIds.map(String)
    : await ensureAllPeerSessions(peerId, { localUserId, localDeviceId });

  for (const deviceId of peerDevices) {
    const result = await lib.encryptMessage(plaintext, peerId, deviceId);
    deviceCiphertexts[deviceId] = result.ciphertext;
  }

  if (includeSelfDevices && localUserId && localUserId !== peerId) {
    const ownDevices = await listPeerDevices(localUserId);
    for (const dev of ownDevices) {
      const ownId = String(dev.device_id || dev.deviceId);
      if (!ownId || ownId === String(localDeviceId)) continue;
      await ensurePeerSession(localUserId, ownId, { localUserId, localDeviceId });
      const result = await lib.encryptMessage(plaintext, localUserId, ownId);
      deviceCiphertexts[ownId] = result.ciphertext;
    }
  }

  const legacy = deviceCiphertexts[peerDevices[0]] || Object.values(deviceCiphertexts)[0];
  return {
    device_ciphertexts: deviceCiphertexts,
    ciphertext: legacy,
    protocol: SIGNAL_PROTOCOL_V1,
  };
}

export async function encryptMessage(plaintext, { peerId, deviceId = '1', localUserId, localDeviceId } = {}) {
  const lib = await loadLibsignal();
  if (lib?.encryptMessage) {
    await ensurePeerSession(peerId, deviceId, { localUserId, deviceId: localDeviceId });
    const result = await lib.encryptMessage(plaintext, peerId, deviceId);
    return { ciphertext: result.ciphertext, protocol: SIGNAL_PROTOCOL_V1 };
  }
  assertLibsignalRuntime('encrypt');
  return buildDevSignalEnvelope(plaintext);
}

export async function decryptMessage(ciphertext, { peerId, deviceId } = {}) {
  const lib = await loadLibsignal();
  if (lib?.decryptMessage) {
    return lib.decryptMessage(ciphertext, peerId, deviceId);
  }
  if (requiresProductionCrypto()) {
    throw new Error('libsignal_required:decrypt');
  }
  const dev = parseDevSignalEnvelope(ciphertext);
  if (dev !== null) return dev;
  try {
    return atob(ciphertext);
  } catch {
    return '[encrypted]';
  }
}

export async function decryptFileBytes(ciphertext) {
  const lib = await loadLibsignal();
  if (lib?.decryptBytes) {
    const result = await lib.decryptBytes(ciphertext);
    return result?.buffer ?? result;
  }
  if (requiresProductionCrypto()) {
    throw new Error('libsignal_required:decrypt_file');
  }
  try {
    const payload = JSON.parse(atob(ciphertext));
    if (payload?.type === 'dev_file' && payload?.data) {
      const binary = atob(payload.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function encryptFileBytes(arrayBuffer) {
  const lib = await loadLibsignal();
  if (lib?.encryptBytes) {
    const result = await lib.encryptBytes(arrayBuffer);
    return { ciphertext: result.ciphertext, protocol: SIGNAL_PROTOCOL_V1 };
  }
  assertLibsignalRuntime('encrypt_file');
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const payload = JSON.stringify({
    v: 1,
    type: 'dev_file',
    data: btoa(binary),
    pad: btoa('x'.repeat(24)),
  });
  return { ciphertext: btoa(payload), protocol: SIGNAL_PROTOCOL_V1 };
}