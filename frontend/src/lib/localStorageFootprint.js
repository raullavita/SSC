/**
 * Audit browser localStorage for forbidden auth material — Engine 5.
 */

const FORBIDDEN_KEY_FRAGMENTS = ['ssc_access_token', 'access_token', 'jwt', 'refresh_token'];

function looksLikeJwt(value) {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export function auditLocalStorageFootprint() {
  const violations = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (FORBIDDEN_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
        violations.push(key);
        continue;
      }
      const value = localStorage.getItem(key);
      if (looksLikeJwt(value)) {
        violations.push(key);
      }
    }
  } catch {
    return { ok: true, violations: [] };
  }
  return { ok: violations.length === 0, violations };
}