import { t } from '../i18n';

describe('email verification i18n keys', () => {
  it('exports required strings in en locale', () => {
    expect(t('emailVerifyCheckInbox', 'en')).toMatch(/email/i);
    expect(t('emailVerifySuccessTitle', 'en')).toMatch(/confirmed/i);
    expect(t('emailVerifyResend', 'en')).toMatch(/Resend/i);
  });
});