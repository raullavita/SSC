/**
 * App lock PIN — device-bound PBKDF2 hash (Q.49). PIN never stored plaintext.
 */
import {
  getHardwareSecret,
  removeHardwareSecret,
  setHardwareSecret,
} from './hardwareSecretStore';
import { unwrapDeviceSecret, wrapDeviceSecret } from './deviceWrapCrypto';
export const APP_LOCK_PIN_SECRET_KEY = 'ssc_app_lock_pin_v1';

const PIN_MIN_LENGTH = 4;
const PIN_ITERATIONS = 120_000;

function toB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function isValidPin(pin) {
  return typeof pin === 'string' && pin.length >= PIN_MIN_LENGTH;
}

async function hashPin(pin, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PIN_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return toB64(bits);
}

async function readPinBlob() {
  const hw = await getHardwareSecret(APP_LOCK_PIN_SECRET_KEY);
  if (hw) return hw;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(APP_LOCK_PIN_SECRET_KEY);
  }
  return null;
}

async function writePinBlob(blob) {
  const ok = await setHardwareSecret(APP_LOCK_PIN_SECRET_KEY, blob);
  if (ok) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(APP_LOCK_PIN_SECRET_KEY);
    }
    return;
  }
  const wrapped = await wrapDeviceSecret(blob);
  if (wrapped && typeof localStorage !== 'undefined') {
    // codeql[js/clear-text-storage-of-sensitive-information]: PBKDF2 hash wrapped with device AES key (Q.49)
    localStorage.setItem(APP_LOCK_PIN_SECRET_KEY, wrapped);
  }
}

async function parseStoredPinRecord() {
  const blob = await readPinBlob();
  if (!blob) return null;
  let raw = blob;
  if (blob.includes('.')) {
    raw = await unwrapDeviceSecret(blob);
  }
  if (!raw) return null;
  const [saltB64, hashB64] = raw.split('|');
  if (!saltB64 || !hashB64) return null;
  return { saltB64, hashB64 };
}

export async function hasAppLockPin() {
  return !!(await parseStoredPinRecord());
}

export async function setAppLockPin(pin) {
  if (!isValidPin(pin)) throw new Error('PIN_TOO_SHORT');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashB64 = await hashPin(pin, salt);
  const record = `${toB64(salt)}|${hashB64}`;
  await writePinBlob(record);
}

export async function verifyAppLockPin(pin) {
  const stored = await parseStoredPinRecord();
  if (!stored || !isValidPin(pin)) return false;
  const hashB64 = await hashPin(pin, fromB64(stored.saltB64));
  return hashB64 === stored.hashB64;
}

export async function clearAppLockPin() {
  await removeHardwareSecret(APP_LOCK_PIN_SECRET_KEY);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(APP_LOCK_PIN_SECRET_KEY);
  }
}