/**
 * Client-side trust store — safety number verification — Step 13.
 * Never synced to server; cleared on panic wipe via ssc_* prefix.
 */

export const TRUST_STATUS = {
  DEFAULT: 'default',
  VERIFIED: 'verified',
  CHANGED: 'changed',
};

const STORAGE_KEY = 'ssc_trust_v1';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function getPeerTrust(peerId) {
  if (!peerId) {
    return { status: TRUST_STATUS.DEFAULT, safetyNumber: null, verifiedAt: null };
  }
  const entry = loadStore()[peerId];
  if (!entry) {
    return { status: TRUST_STATUS.DEFAULT, safetyNumber: null, verifiedAt: null };
  }
  return {
    status: entry.status || TRUST_STATUS.DEFAULT,
    safetyNumber: entry.safetyNumber || null,
    verifiedAt: entry.verifiedAt || null,
    previousSafetyNumber: entry.previousSafetyNumber || null,
  };
}

export function syncPeerSafetyNumber(peerId, displayable) {
  if (!peerId || !displayable) return TRUST_STATUS.DEFAULT;
  const store = loadStore();
  const prev = store[peerId] || { status: TRUST_STATUS.DEFAULT };

  if (
    prev.status === TRUST_STATUS.VERIFIED &&
    prev.safetyNumber &&
    prev.safetyNumber !== displayable
  ) {
    store[peerId] = {
      ...prev,
      status: TRUST_STATUS.CHANGED,
      previousSafetyNumber: prev.safetyNumber,
      safetyNumber: displayable,
      changedAt: new Date().toISOString(),
    };
    saveStore(store);
    return TRUST_STATUS.CHANGED;
  }

  if (prev.status === TRUST_STATUS.CHANGED && prev.safetyNumber === displayable) {
    saveStore(store);
    return TRUST_STATUS.CHANGED;
  }

  store[peerId] = {
    ...prev,
    safetyNumber: displayable,
    status: prev.status === TRUST_STATUS.VERIFIED ? TRUST_STATUS.VERIFIED : TRUST_STATUS.DEFAULT,
  };
  saveStore(store);
  return store[peerId].status;
}

export function markPeerVerified(peerId, displayable) {
  if (!peerId || !displayable) return;
  const store = loadStore();
  store[peerId] = {
    status: TRUST_STATUS.VERIFIED,
    safetyNumber: displayable,
    verifiedAt: new Date().toISOString(),
  };
  saveStore(store);
}

export function clearPeerTrust(peerId) {
  if (!peerId) return;
  const store = loadStore();
  delete store[peerId];
  saveStore(store);
}

export function trustBadgeLabel(status) {
  if (status === TRUST_STATUS.VERIFIED) return 'Verified';
  if (status === TRUST_STATUS.CHANGED) return 'Key changed';
  return 'Unverified';
}