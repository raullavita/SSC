/**
 * Identity key resolution — Engine 8.2.
 * Supports legacy RSA (today) and signal_v1 Curve25519 (step 8.3+).
 */
import { b64ToBytes } from './crypto';
import { importPublicKey } from './crypto';

export const IDENTITY_KEY_TYPES = {
  LEGACY_RSA: 'legacy_rsa',
  SIGNAL_V1: 'signal_v1',
};

/** @typedef {{ type: string, jwk?: object, signalPublicB64?: string }} ResolvedIdentity */

export function parsePublicKeyJwk(publicKeyField) {
  if (!publicKeyField) return null;
  if (typeof publicKeyField === 'object') return publicKeyField;
  try {
    return JSON.parse(publicKeyField);
  } catch {
    return null;
  }
}

/**
 * Resolve stored user identity material for safety numbers / verification.
 * @param {{ public_key?: string|object, signal_identity_key_public?: string }} user
 * @returns {ResolvedIdentity|null}
 */
export function resolveUserIdentity(user) {
  if (!user) return null;
  const signalB64 = (
    user.signal_identity_key_public
    || user.signal_prekey_bundle?.identity_key_public
    || ''
  ).trim();
  const signalPrimary = user.identity_primary === IDENTITY_KEY_TYPES.SIGNAL_V1
    || user.signal_prekeys_ready;
  if (signalB64) {
    return { type: IDENTITY_KEY_TYPES.SIGNAL_V1, signalPublicB64: signalB64 };
  }
  if (signalPrimary) {
    return null;
  }
  const jwk = parsePublicKeyJwk(user.public_key);
  if (!jwk) return null;
  return { type: IDENTITY_KEY_TYPES.LEGACY_RSA, jwk };
}

/**
 * Canonical bytes fed into Signal-style fingerprint generator.
 * @param {ResolvedIdentity} identity
 * @returns {Promise<Uint8Array>}
 */
export async function identityKeyToBytes(identity) {
  if (!identity) throw new Error('missing identity');
  if (identity.type === IDENTITY_KEY_TYPES.SIGNAL_V1) {
    const raw = b64ToBytes(identity.signalPublicB64);
    if (raw.length === 32) {
      const out = new Uint8Array(33);
      out[0] = 0x05;
      out.set(raw, 1);
      return out;
    }
    if (raw.length === 33) return raw;
    throw new Error('invalid signal identity key length');
  }
  const pub = await importPublicKey(identity.jwk);
  const spki = await crypto.subtle.exportKey('spki', pub);
  return new Uint8Array(spki);
}

export function identityStorageFingerprint(identity) {
  if (identity.type === IDENTITY_KEY_TYPES.SIGNAL_V1) {
    return `signal:${identity.signalPublicB64}`;
  }
  const jwk = identity.jwk || {};
  return `rsa:${jwk.n || ''}:${jwk.e || ''}`;
}