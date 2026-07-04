import { auditLocalStorageFootprint } from '../localStorageFootprint';

describe('localStorageFootprint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('passes when localStorage has no auth material', () => {
    localStorage.setItem('ssc_theme', 'dark');
    expect(auditLocalStorageFootprint()).toEqual({ ok: true, violations: [] });
  });

  test('flags forbidden token keys', () => {
    localStorage.setItem('ssc_access_token', 'abc');
    const result = auditLocalStorageFootprint();
    expect(result.ok).toBe(false);
    expect(result.violations).toContain('ssc_access_token');
  });
});