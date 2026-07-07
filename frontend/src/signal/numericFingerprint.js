/**
 * Dev/browser numeric fingerprint — mirrors libsignal version 5200 layout.
 */

const VERSION = 2;
const ITERATIONS = 5200;

function b64ToBytes(b64) {
  if (!b64) return new Uint8Array();
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function toDecimalGroups(hashBytes) {
  let numeric = 0n;
  for (let i = 0; i < 30 && i < hashBytes.length; i += 1) {
    numeric = (numeric * 256n + BigInt(hashBytes[i])) % 100000000000000000000000000000000000000000000000000n;
  }
  const digits = numeric.toString().padStart(60, '0').slice(-60);
  const groups = [];
  for (let i = 0; i < 60; i += 5) {
    groups.push(digits.slice(i, i + 5));
  }
  return groups.join(' ');
}

export async function numericFingerprintDisplayable({
  localUserId,
  remoteUserId,
  localIdentityKeyB64,
  remoteIdentityKeyB64,
}) {
  const enc = new TextEncoder();
  const versionBytes = new Uint8Array([VERSION >> 8, VERSION & 0xff]);
  const localId = enc.encode(localUserId);
  const remoteId = enc.encode(remoteUserId);
  const localKey = b64ToBytes(localIdentityKeyB64);
  const remoteKey = b64ToBytes(remoteIdentityKeyB64);
  let material = concatBytes(versionBytes, localId, localKey, remoteId, remoteKey);
  let hash = material;
  for (let i = 0; i < ITERATIONS; i += 1) {
    hash = new Uint8Array(await crypto.subtle.digest('SHA-512', hash));
  }
  return toDecimalGroups(hash);
}