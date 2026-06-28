import { api } from './api';

const FALLBACK_RETENTION_HOURS = 24;

export async function fetchPublicConfig() {
  const { data } = await api.get('/config');
  return data || {};
}

export async function fetchRetentionConfig() {
  try {
    const cfg = await fetchPublicConfig();
    const retention = cfg?.retention || {};
    const hours = Number(retention.hours);
    const allowed = Array.isArray(retention.allowed_hours)
      ? retention.allowed_hours.map((h) => Number(h)).filter((h) => Number.isFinite(h) && h > 0)
      : [];
    if (Number.isFinite(hours) && hours > 0) {
      return {
        hours,
        defaultHours: Number(retention.default_hours) || hours,
        allowedHours: allowed.length ? allowed : undefined,
        perUser: !!retention.per_user,
      };
    }
  } catch {
    // Keep UI informative even if config request fails.
  }
  return { hours: FALLBACK_RETENTION_HOURS };
}
