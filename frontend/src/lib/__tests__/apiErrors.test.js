import { formatApiError } from '../apiErrors';

describe('formatApiError', () => {
  it('maps prekey bundle detail', () => {
    expect(formatApiError({ body: { detail: 'prekey_bundle_not_found' } })).toMatch(
      /open SSC once/
    );
  });

  it('maps contact_prekeys_missing from message', () => {
    expect(
      formatApiError(new Error('contact_prekeys_missing: Ask them to open SSC'))
    ).toMatch(/open SSC once/);
  });

  it('uses string detail', () => {
    expect(formatApiError({ body: { detail: 'message_rate_limited' } })).toMatch(
      /too quickly/
    );
  });

  it('falls back for bare HTTP errors', () => {
    expect(formatApiError(new Error('HTTP 400'), 'Send failed')).toBe('Send failed');
  });
});