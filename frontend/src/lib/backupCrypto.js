/**
 * Passphrase-encrypted backup envelope — Step 16.
 * Uses Web Crypto PBKDF2 + AES-256-GCM; never sent to server.
 */

const BACKUP_FORMAT = 'ssc-backup';
const BACKUP_VERSION = 1;
export const BACKUP_FILE_EXTENSION = '.ssc-backup';
export const MIN_PASSPHRASE_LENGTH = 8;
const PBKDF2_ITERATIONS = 310000;

const FORBIDDEN_KEY_FRAGMENTS = ['access_token', 'refresh_token', 'jwt'];

function getSubtle() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto not available');
  }
  return globalThis.crypto.subtle;
}

function bytesToB64(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(passphrase, salt) {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isForbiddenBackupKey(key) {
  if (!key) return true;
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function assertPassphrase(passphrase) {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }
}

export async function encryptBackupPayload(plaintext, passphrase) {
  assertPassphrase(passphrase);
  const subtle = getSubtle();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    enc.encode(plaintext)
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: 'pbkdf2',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'aes-256-gcm',
    salt: bytesToB64(salt),
    nonce: bytesToB64(nonce),
    ciphertext: bytesToB64(new Uint8Array(ciphertext)),
  };
}

export async function decryptBackupPayload(envelope, passphrase) {
  assertPassphrase(passphrase);
  if (!envelope || envelope.format !== BACKUP_FORMAT) {
    throw new Error('Invalid backup file format');
  }
  if (envelope.version !== BACKUP_VERSION) {
    throw new Error('Unsupported backup version');
  }
  const subtle = getSubtle();
  const salt = b64ToBytes(envelope.salt);
  const nonce = b64ToBytes(envelope.nonce);
  const key = await deriveKey(passphrase, salt);
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    b64ToBytes(envelope.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

export function validateBackupEnvelope(envelope) {
  if (!envelope || envelope.format !== BACKUP_FORMAT) {
    throw new Error('Invalid backup file format');
  }
  if (envelope.version !== BACKUP_VERSION) {
    throw new Error('Unsupported backup version');
  }
  if (!envelope.salt || !envelope.nonce || !envelope.ciphertext) {
    throw new Error('Backup file is incomplete');
  }
}