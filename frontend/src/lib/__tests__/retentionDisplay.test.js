import {
  formatRetentionDuration,
  normalizeRetentionHours,
  retentionOptionLabel,
  RETENTION_HOUR_OPTIONS,
} from '../retentionDisplay';
import { t } from '../i18n';

const tr = (key, vars) => t(key, 'en', vars);

describe('retentionDisplay', () => {
  it('exposes allowed hour options', () => {
    expect(RETENTION_HOUR_OPTIONS).toEqual([1, 2, 4, 8, 24, 168, 720]);
  });

  it('normalizes to allowed values with fallback', () => {
    expect(normalizeRetentionHours(8)).toBe(8);
    expect(normalizeRetentionHours(6)).toBe(24);
    expect(normalizeRetentionHours(undefined)).toBe(24);
  });

  it('formats hour and day labels', () => {
    expect(formatRetentionDuration(4, tr)).toContain('4');
    expect(formatRetentionDuration(168, tr)).toMatch(/7/);
    expect(formatRetentionDuration(720, tr)).toMatch(/30/);
  });

  it('maps select option labels', () => {
    expect(retentionOptionLabel(1, tr)).toBe(t('settingsRetention1h', 'en'));
    expect(retentionOptionLabel(720, tr)).toBe(t('settingsRetention30d', 'en'));
  });
});