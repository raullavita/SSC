/**
 * Legacy/dev sender key material — localStorage (Engine 9).
 * Installed clients use libsignal SenderKeyStore in Electron (`groupSenderKeySession.js`).
 */

const STORE_KEY = 'ssc_sender_keys_v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function storeKey(groupId, senderId, keyMaterial) {
  const store = readStore();
  if (!store[groupId]) store[groupId] = {};
  store[groupId][senderId] = keyMaterial;
  writeStore(store);
}

export function getSenderKey(groupId, senderId) {
  const store = readStore();
  return store[groupId]?.[senderId] || null;
}


function generateSenderKeyMaterial() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function rememberSenderKey(groupId, senderId, keyMaterial) {
  if (!groupId || !senderId || !keyMaterial) return;
  storeKey(groupId, senderId, keyMaterial);
}

export function ensureOwnSenderKey(groupId, userId) {
  const existing = getSenderKey(groupId, userId);
  if (existing) return existing;
  const material = generateSenderKeyMaterial();
  rememberSenderKey(groupId, userId, material);
  return material;
}

const SENDER_KEY_DIST_PREFIX = 'ssc-skd:';

export function packSenderKeyDistribution({ groupId, senderId, keyMaterial }) {
  return `${SENDER_KEY_DIST_PREFIX}${JSON.stringify({
    groupId,
    senderId,
    keyMaterial,
  })}`;
}

export function unpackSenderKeyDistribution(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith(SENDER_KEY_DIST_PREFIX)) return null;
  try {
    return JSON.parse(ciphertext.slice(SENDER_KEY_DIST_PREFIX.length));
  } catch {
    return null;
  }
}