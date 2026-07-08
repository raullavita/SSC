/**
 * Signal crypto bridge — @signalapp/libsignal-client (Electron) with dev fallback (dev only).
 */

import { api } from '../lib/api';
import {
  assertLibsignalRuntime,
  requiresProductionCrypto,
} from '../lib/cryptoPolicy';
import { getInstalledClientHeader } from '../lib/installedClient';
import {
  SIGNAL_PROTOCOL_V1,
  buildDevSignalEnvelope,
  parseDevSignalEnvelope,
} from './envelope';

let libsignalModule = null;
let configuredLocalUserId = null;

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

async function configureLocalIdentity(lib, { localUserId, deviceId = '1' } = {}) {
  const userId = localUserId || configuredLocalUserId;
  if (!lib?.configure || !userId) return;
  configuredLocalUserId = userId;
  await lib.configure({ localUserId: userId, deviceId });
}

export async function registerDeviceAndPrekeys({
  deviceId,
  deviceName,
  platform,
  localUserId,
}) {
  const lib = await loadLibsignal();
  assertLibsignalRuntime('register_prekeys');
  await configureLocalIdentity(lib, { localUserId, deviceId });
  if (!lib?.generatePreKeyBundle) {
    if (requiresProductionCrypto()) {
      throw new Error('libsignal_required:prekeys');
    }
    return { deviceId, prekeysUploaded: false, mode: 'dev' };
  }

  const bundle = await lib.generatePreKeyBundle();

  await api.post('/api/devices', {
    device_id: deviceId,
    name: deviceName,
    platform,
  });
  await api.put('/api/prekeys/bundle', normalizePreKeyBundlePayload(deviceId, bundle));
  return { deviceId, prekeysUploaded: true, mode: 'libsignal' };
}

async function ensurePeerSession(peerId, deviceId = '1') {
  const lib = await loadLibsignal();
  if (!peerId) {
    throw new Error('peer_id_required');
  }
  if (!lib?.establishSession) return;
  await configureLocalIdentity(lib, { deviceId: '1' });
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

export async function encryptMessage(plaintext, { peerId, deviceId = '1' } = {}) {
  const lib = await loadLibsignal();
  if (lib?.encryptMessage) {
    await ensurePeerSession(peerId, deviceId);
    const result = await lib.encryptMessage(plaintext, peerId, deviceId);
    return { ciphertext: result.ciphertext, protocol: SIGNAL_PROTOCOL_V1 };
  }
  assertLibsignalRuntime('encrypt');
  return buildDevSignalEnvelope(plaintext);
}

export async function decryptMessage(ciphertext, { peerId } = {}) {
  const lib = await loadLibsignal();
  if (lib?.decryptMessage) {
    return lib.decryptMessage(ciphertext, peerId);
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


