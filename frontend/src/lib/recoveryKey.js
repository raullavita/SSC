/**
 * Account recovery key helpers — Q.41 show-once backup codes for vault path.
 */
import { api } from './api';
import { unwrapPrivateKey, wrapPrivateKey } from './crypto';

export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    codes.push(hex.toUpperCase());
  }
  return codes;
}

export function normalizeRecoveryCode(code) {
  return (code || '').trim().toUpperCase().replace(/[-\s]/g, '');
}

export function formatRecoveryCode(code) {
  const norm = normalizeRecoveryCode(code);
  if (norm.length !== 8) return norm;
  return `${norm.slice(0, 4)}-${norm.slice(4)}`;
}

export function recoverySecretFromCodes(codes) {
  const normalized = codes.map(normalizeRecoveryCode);
  if (normalized.length !== RECOVERY_CODE_COUNT) {
    throw new Error('RECOVERY_CODE_COUNT');
  }
  if (normalized.some((c) => c.length !== 8)) {
    throw new Error('RECOVERY_CODE_FORMAT');
  }
  return normalized.join('');
}

export function parseRecoveryCodesInput(raw) {
  const parts = (raw || '')
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === RECOVERY_CODE_COUNT) return parts;
  const joined = parts.join('').replace(/-/g, '');
  if (joined.length === RECOVERY_CODE_COUNT * 8) {
    const out = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      out.push(joined.slice(i * 8, (i + 1) * 8));
    }
    return out;
  }
  throw new Error('RECOVERY_CODE_PARSE');
}

export async function fetchRecoveryStatus() {
  const { data } = await api.get('/auth/recovery/status');
  return data;
}

export async function buildRecoveryWrap(privateKey, recoveryCodes) {
  const secret = recoverySecretFromCodes(recoveryCodes);
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  return wrapPrivateKey(jwk, secret);
}

export async function setupRecoveryKey({
  password,
  encryptedPrivateKey,
  pkSalt,
  recoveryCodes,
}) {
  const pk = await unwrapPrivateKey(encryptedPrivateKey, pkSalt, password);
  const recoveryWrap = await buildRecoveryWrap(pk, recoveryCodes);
  const { data } = await api.post('/auth/recovery/setup', {
    password,
    recovery_encrypted_private_key: recoveryWrap.encrypted_private_key,
    recovery_pk_salt: recoveryWrap.pk_salt,
    recovery_codes: recoveryCodes,
  });
  return data;
}

export async function regenerateRecoveryKey({
  password,
  encryptedPrivateKey,
  pkSalt,
  recoveryCodes,
}) {
  const pk = await unwrapPrivateKey(encryptedPrivateKey, pkSalt, password);
  const recoveryWrap = await buildRecoveryWrap(pk, recoveryCodes);
  const { data } = await api.post('/auth/recovery/regenerate', {
    password,
    recovery_encrypted_private_key: recoveryWrap.encrypted_private_key,
    recovery_pk_salt: recoveryWrap.pk_salt,
    recovery_codes: recoveryCodes,
  });
  return data;
}

export async function resetPasswordWithRecovery({
  identifier,
  recoveryCodes,
  newPassword,
}) {
  const { data: wrap } = await api.post('/auth/recovery/fetch-wrap', {
    identifier: identifier.trim(),
    recovery_codes: recoveryCodes,
  });
  const secret = recoverySecretFromCodes(recoveryCodes);
  const pk = await unwrapPrivateKey(
    wrap.recovery_encrypted_private_key,
    wrap.recovery_pk_salt,
    secret,
  );
  const jwk = await crypto.subtle.exportKey('jwk', pk);
  const wrapped = await wrapPrivateKey(jwk, newPassword);
  const { data } = await api.post('/auth/recovery/reset-password', {
    identifier: identifier.trim(),
    recovery_codes: recoveryCodes,
    new_password: newPassword,
    encrypted_private_key: wrapped.encrypted_private_key,
    pk_salt: wrapped.pk_salt,
  });
  return data;
}