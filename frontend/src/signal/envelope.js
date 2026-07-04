/**
 * signal_v1 wire envelope helpers — dev fallback when Electron/libsignal unavailable.
 * Production installed clients use @signalapp/libsignal-client via signalBridge.
 */

const PROTOCOL = 'signal_v1';

function randomBytes(length) {
  const buf = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function buildDevSignalEnvelope(plaintext) {
  const payload = {
    v: 1,
    type: 'dev_envelope',
    body: plaintext,
    pad: bytesToBase64(randomBytes(24)),
  };
  const json = JSON.stringify(payload);
  const bytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(json)
    : Uint8Array.from(json, (c) => c.charCodeAt(0));
  return { ciphertext: bytesToBase64(bytes), protocol: PROTOCOL };
}

export function parseDevSignalEnvelope(ciphertext) {
  try {
    const json = atob(ciphertext);
    const payload = JSON.parse(json);
    if (payload?.type === 'dev_envelope' && typeof payload.body === 'string') {
      return payload.body;
    }
  } catch {
    /* not a dev envelope */
  }
  return null;
}

export { PROTOCOL as SIGNAL_PROTOCOL_V1 };