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

export async function registerDeviceAndPrekeys({ deviceId, deviceName, platform }) {
  await api.post('/api/devices', {
    device_id: deviceId,
    name: deviceName,
    platform,
  });

  const lib = await loadLibsignal();
  assertLibsignalRuntime('register_prekeys');
  if (!lib?.generatePreKeyBundle) {
    if (requiresProductionCrypto()) {
      throw new Error('libsignal_required:prekeys');
    }
    return { deviceId, prekeysUploaded: false, mode: 'dev' };
  }

  const bundle = await lib.generatePreKeyBundle();
  await api.put('/api/prekeys/bundle', {
    device_id: deviceId,
    registration_id: bundle.registrationId,
    identity_key: bundle.identityKey,
    signed_prekey: bundle.signedPreKey,
    prekeys: bundle.preKeys,
    kyber_prekey: bundle.kyberPreKey || null,
  });
  return { deviceId, prekeysUploaded: true, mode: 'libsignal' };
}

async function ensurePeerSession(peerId, deviceId = '1') {
  const lib = await loadLibsignal();
  if (!lib?.establishSession || !peerId) return;
  try {
    const data = await api.get(`/api/prekeys/users/${peerId}/devices/${deviceId}`);
    const bundle = data.bundle || data;
    await lib.establishSession(peerId, deviceId, bundle);
  } catch {
    if (requiresProductionCrypto()) {
      throw new Error('libsignal_session_setup_failed');
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


