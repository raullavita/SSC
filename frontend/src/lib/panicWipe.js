/**
 * Panic wipe — server (user-scoped) + local device footprint clear.
 */

import { api } from './api';
import { clearLinkedDeviceId } from './deviceLink';
import { clientFootprintClean } from './clientFootprintOrchestrator';
import { clearIceServerCache } from '../calls/iceServers';
import { clearAllIndexes } from '../search/messageIndex';

const SSC_LOCAL_PREFIXES = ['ssc_', 'SSC_'];

function clearLocalClientData() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && SSC_LOCAL_PREFIXES.some((p) => key.toLowerCase().startsWith(p.toLowerCase()))) {
        keys.push(key);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    clearAllIndexes();
  } catch {
    /* ignore */
  }
  try {
    clearIceServerCache();
  } catch {
    /* ignore */
  }
}

async function clearNativeCryptoStore() {
  try {
    if (typeof window !== 'undefined' && window.sscCrypto?.wipeLocalData) {
      await window.sscCrypto.wipeLocalData();
    }
  } catch {
    /* ignore */
  }
}

export async function executePanicWipe() {
  let result = null;
  let serverError = null;
  try {
    result = await api.post('/api/panic/wipe', {});
  } catch (err) {
    serverError = err;
  }
  await clearNativeCryptoStore();
  clearLinkedDeviceId();
  clearLocalClientData();
  if (!clientFootprintClean()) {
    console.warn('[ssc] panic wipe completed but localStorage footprint still has violations');
  }
  if (serverError) throw serverError;
  return result;
}