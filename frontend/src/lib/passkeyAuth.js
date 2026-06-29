/**
 * WebAuthn / passkey helpers — Q.40 optional passwordless login.
 */
import { api } from './api';

export function isPasskeySupported() {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  const { PublicKeyCredential } = window;
  return !!(
    PublicKeyCredential
    && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function'
    && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function'
    && typeof PublicKeyCredential.prototype.toJSON === 'function'
  );
}

export async function fetchPasskeyConfig() {
  try {
    const { data } = await api.get('/auth/passkey/config');
    return data;
  } catch {
    return { enabled: false, rp_id: '' };
  }
}

export async function createPasskeyCredential(options) {
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options);
  const cred = await navigator.credentials.create({ publicKey });
  if (!cred) throw new Error('PASSKEY_CANCELLED');
  return cred.toJSON();
}

export async function getPasskeyAssertion(options) {
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(options);
  const cred = await navigator.credentials.get({ publicKey });
  if (!cred) throw new Error('PASSKEY_CANCELLED');
  return cred.toJSON();
}

export async function registerPasskey({ deviceName } = {}) {
  const { data: opt } = await api.post('/auth/passkey/register/options', {
    device_name: deviceName || undefined,
  });
  const credential = await createPasskeyCredential(opt.options);
  const { data } = await api.post('/auth/passkey/register/verify', {
    challenge_id: opt.challenge_id,
    credential,
  });
  return data;
}

export async function loginWithPasskey({ identifier, totpCode } = {}) {
  const { data: opt } = await api.post('/auth/passkey/login/options', {
    identifier: identifier?.trim() || null,
  });
  const credential = await getPasskeyAssertion(opt.options);
  const { data } = await api.post('/auth/passkey/login/verify', {
    challenge_id: opt.challenge_id,
    credential,
    totp_code: totpCode || undefined,
  });
  return data;
}

export async function listPasskeys() {
  const { data } = await api.get('/auth/passkey/credentials');
  return data || [];
}

export async function deletePasskey(credentialId) {
  await api.delete('/auth/passkey/credentials', { data: { credential_id: credentialId } });
}