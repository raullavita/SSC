/**
 * Signal crypto bridge — @signalapp/libsignal-client (Electron) with dev envelope fallback.
 * Charter: official Signal libs only in production installed clients.
 */

import { api } from '../lib/api';
import { getInstalledClientHeader } from '../lib/installedClient';
import {
  SIGNAL_PROTOCOL_V1,
  buildDevSignalEnvelope,
  parseDevSignalEnvelope,
} from './envelope';

let libsignalModule = null;

async function loadLibsignal() {
  if (libsignalModule) return libsignalModule;
  if (typeof window !== 'undefined' && window.sscCrypto?.encrypt) {
    libsignalModule = window.sscCrypto;
    return libsignalModule;
  }
  try {
    // Electron / Node context only — not bundled for CRA browser by default.
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
  if (!lib?.generatePreKeyBundle) {
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

export async function encryptMessage(plaintext, { peerId, deviceId = '1' } = {}) {
  const lib = await loadLibsignal();
  if (lib?.encryptMessage) {
    const result = await lib.encryptMessage(plaintext, peerId, deviceId);
    return { ciphertext: result.ciphertext, protocol: SIGNAL_PROTOCOL_V1 };
  }
  return buildDevSignalEnvelope(plaintext);
}

export async function decryptMessage(ciphertext, { peerId } = {}) {
  const lib = await loadLibsignal();
  if (lib?.decryptMessage) {
    return lib.decryptMessage(ciphertext, peerId);
  }
  const dev = parseDevSignalEnvelope(ciphertext);
  if (dev !== null) return dev;
  try {
    return atob(ciphertext);
  } catch {
    return '[encrypted]';
  }
}

export async function encryptFileBytes(arrayBuffer) {
  const lib = await loadLibsignal();
  if (lib?.encryptBytes) {
    const result = await lib.encryptBytes(arrayBuffer);
    return { ciphertext: result.ciphertext, protocol: SIGNAL_PROTOCOL_V1 };
  }
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const payload = JSON.stringify({ v: 1, type: 'dev_file', data: btoa(binary), pad: btoa('x'.repeat(24)) });
  return { ciphertext: btoa(payload), protocol: SIGNAL_PROTOCOL_V1 };
}

export function getSignalLibTarget() {
  return '0.96.4';
}

export function installedClientHeader() {
  return getInstalledClientHeader();
}