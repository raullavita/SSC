/** Per-user retention labels — Q.5 (1h, 2h, 4h, 8h, 24h, 7d, 30d). */

export const DEFAULT_RETENTION_HOURS = 24;

export const RETENTION_HOUR_OPTIONS = [1, 2, 4, 8, 24, 168, 720];

export function normalizeRetentionHours(value, fallback = DEFAULT_RETENTION_HOURS) {
  const hours = Number(value);
  if (RETENTION_HOUR_OPTIONS.includes(hours)) return hours;
  return fallback;
}

export function retentionOptionLabel(hours, t) {
  switch (hours) {
    case 1: return t('settingsRetention1h');
    case 2: return t('settingsRetention2h');
    case 4: return t('settingsRetention4h');
    case 8: return t('settingsRetention8h');
    case 24: return t('settingsRetention24h');
    case 168: return t('settingsRetention7d');
    case 720: return t('settingsRetention30d');
    default: return formatRetentionDuration(hours, t);
  }
}

export function formatRetentionDuration(hours, t) {
  const value = Number(hours);
  if (value === 168) return t('retentionDuration7d');
  if (value === 720) return t('retentionDuration30d');
  return t('retentionBadge', { hours: String(value) });
}