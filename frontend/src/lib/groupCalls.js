import { getBackendUrl } from './platform';

const DEFAULT_POLICY = {
  mode: 'mesh',
  max_mesh_participants: 6,
  sfu_enabled: false,
  sfu_url: null,
};

let cachedPolicy = null;

export async function fetchGroupCallPolicy() {
  if (cachedPolicy) return cachedPolicy;
  try {
    const res = await fetch(`${getBackendUrl()}/api/config`);
    const cfg = await res.json();
    cachedPolicy = { ...DEFAULT_POLICY, ...(cfg.group_calls || {}) };
  } catch {
    cachedPolicy = { ...DEFAULT_POLICY };
  }
  return cachedPolicy;
}

/** @returns {string|null} Error message if call cannot start, else null */
export async function validateGroupCallSize(memberCount) {
  const policy = await fetchGroupCallPolicy();
  const total = memberCount + 1; // include self
  if (policy.sfu_enabled && policy.sfu_url) {
    return null;
  }
  if (total <= policy.max_mesh_participants) {
    return null;
  }
  return `Group calls above ${policy.max_mesh_participants} need SFU (not deployed yet)`;
}

export function clearGroupCallPolicyCache() {
  cachedPolicy = null;
}