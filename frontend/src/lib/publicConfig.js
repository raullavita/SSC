import { api } from './api';

const FALLBACK_RETENTION_HOURS = 24;

export async function fetchPublicConfig() {
  const { data } = await api.get('/config');
  return data || {};
}

export async function fetchRetentionConfig() {
  try {
    const cfg = await fetchPublicConfig();
    const hours = Number(cfg?.retention?.hours);
    if (Number.isFinite(hours) && hours > 0) {
      return { hours };
    }
  } catch {
    // Keep UI informative even if config request fails.
  }
  return { hours: FALLBACK_RETENTION_HOURS };
}
