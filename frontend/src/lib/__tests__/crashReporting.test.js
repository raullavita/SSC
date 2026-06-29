import {
  captureCrash,
  isCrashReportingOptedIn,
  scrubErrorForReport,
  setCrashReportingOptIn,
} from '../crashReporting';

describe('crashReporting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to opt-out', () => {
    expect(isCrashReportingOptedIn()).toBe(false);
  });

  it('persists opt-in locally', async () => {
    await setCrashReportingOptIn(true);
    expect(isCrashReportingOptedIn()).toBe(true);
    await setCrashReportingOptIn(false);
    expect(isCrashReportingOptedIn()).toBe(false);
  });

  it('scrubs sensitive keys from errors', () => {
    const err = new Error('token=abc123 password=secret');
    const scrubbed = scrubErrorForReport(err);
    expect(scrubbed.message).toContain('token=[redacted]');
    expect(scrubbed.message).toContain('password=[redacted]');
    expect(scrubbed.message).not.toContain('abc123');
  });

  it('skips capture when opted out', async () => {
    const result = await captureCrash(new Error('boom'));
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('opt_out');
  });
});