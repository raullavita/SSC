/**
 * Panic wipe — server + local footprint clear.
 */

import { api } from './api';
const SSC_LOCAL_PREFIXES = ['ssc_', 'SSC_'];

export function clearLocalClientData() {
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
}

export async function executePanicWipe() {
  const result = await api.post('/api/panic/wipe', {});
  clearLocalClientData();
  return result;
}