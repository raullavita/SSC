/**
 * E2E crypto utilities (browser WebCrypto)
 * - RSA-OAEP 2048 for key wrapping
 * - AES-256-GCM for message body
 * - PBKDF2 + AES-GCM to wrap the user's private key with their password
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBytes(b64s) {
  const bin = atob(b64s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function generateRSAKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { publicKeyJwk: pubJwk, privateKeyJwk: privJwk };
}

async function deriveKeyFromPassword(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapPrivateKey(privateKeyJwk, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);
  const plaintext = enc.encode(JSON.stringify(privateKeyJwk));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    encrypted_private_key: b64(ct) + '.' + b64(iv),
    pk_salt: b64(salt),
  };
}

export async function unwrapPrivateKey(encryptedB64, saltB64, password) {
  const [ctB64, ivB64] = encryptedB64.split('.');
  const salt = b64ToBytes(saltB64);
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const key = await deriveKeyFromPassword(password, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const jwk = JSON.parse(dec.decode(pt));
  return await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'],
  );
}

export async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}

async function encryptPayloadForRecipients(payloadBytes, recipientPublicJwks) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, payloadBytes);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);

  const encryptedKeys = {};
  for (const [uid, jwk] of Object.entries(recipientPublicJwks)) {
    if (!jwk) continue;
    const pub = await importPublicKey(jwk);
    const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, rawAes);
    encryptedKeys[uid] = b64(wrapped);
  }
  return { ciphertext: b64(ctBuf), iv: b64(iv), encrypted_keys: encryptedKeys };
}

async function decryptPayload(privateKey, ciphertextBytes, ivB64, encryptedKeyB64) {
  const wrappedAes = b64ToBytes(encryptedKeyB64);
  const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedAes);
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = b64ToBytes(ivB64);
  const ct = ciphertextBytes instanceof Uint8Array ? ciphertextBytes : b64ToBytes(ciphertextBytes);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new Uint8Array(pt);
}

export async function encryptMessageForRecipients(plaintext, recipientPublicJwks) {
  return encryptPayloadForRecipients(enc.encode(plaintext), recipientPublicJwks);
}

/** Encrypt raw file/voice bytes before upload (E2E attachments). */
export async function encryptBytesForRecipients(data, recipientPublicJwks) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return encryptPayloadForRecipients(bytes, recipientPublicJwks);
}

export async function decryptMessage(privateKey, ciphertextB64, ivB64, encryptedKeyB64) {
  const pt = await decryptPayload(privateKey, b64ToBytes(ciphertextB64), ivB64, encryptedKeyB64);
  return dec.decode(pt);
}

/** Decrypt an E2E attachment downloaded from the server. */
export async function decryptBytes(privateKey, ciphertext, ivB64, encryptedKeyB64) {
  return decryptPayload(privateKey, ciphertext, ivB64, encryptedKeyB64);
}

// fingerprint of public key for visual verification
export async function publicKeyFingerprint(jwk) {
  const bytes = enc.encode(JSON.stringify(jwk));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(hash)).slice(0, 16);
  return arr.map((b) => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}
