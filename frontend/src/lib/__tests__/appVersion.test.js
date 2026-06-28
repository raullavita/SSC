import {
  compareSemver,
  getAppVersion,
  isVersionNewer,
  parseSemver,
} from '../appVersion';

describe('appVersion', () => {
  it('returns build-time version with fallback', () => {
    expect(getAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('parses semver triples', () => {
    expect(parseSemver('1.0.12')).toEqual({ major: 1, minor: 0, patch: 12 });
    expect(parseSemver('v2.3.4')).toBeNull();
  });

  it('compares semver ordering', () => {
    expect(compareSemver('1.0.13', '1.0.12')).toBeGreaterThan(0);
    expect(compareSemver('1.0.12', '1.0.12')).toBe(0);
    expect(compareSemver('1.0.11', '1.0.12')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('detects newer remote versions', () => {
    expect(isVersionNewer('1.0.13', '1.0.12')).toBe(true);
    expect(isVersionNewer('1.0.12', '1.0.12')).toBe(false);
    expect(isVersionNewer('1.0.11', '1.0.12')).toBe(false);
  });
});