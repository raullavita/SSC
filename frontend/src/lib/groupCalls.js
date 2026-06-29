import { getBackendUrl } from './platform';

const DEFAULT_POLICY = {
  mode: 'mesh',
  max_mesh_participants: 8,
  sfu_min_participants: 9,
  sfu_enabled: false,
  sfu_url: null,
};

/** @returns {'mesh'|'sfu'} */
export function resolveGroupCallMediaMode(memberCount, policy) {
  const total = memberCount + 1;
  if (total > policy.max_mesh_participants) {
    if (policy.sfu_enabled && policy.sfu_url) return 'sfu';
    return null;
  }
  return 'mesh';
}

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
  if (resolveGroupCallMediaMode(memberCount, policy)) {
    return null;
  }
  return `Group calls above ${policy.max_mesh_participants} need SFU (not deployed yet)`;
}

/** @returns {Promise<'mesh'|'sfu'>} */
export async function resolveGroupCallModeForStart(memberCount) {
  const policy = await fetchGroupCallPolicy();
  const mode = resolveGroupCallMediaMode(memberCount, policy);
  if (!mode) {
    throw new Error(`Group calls above ${policy.max_mesh_participants} need SFU`);
  }
  return mode;
}

export function clearGroupCallPolicyCache() {
  cachedPolicy = null;
}