import { openOAuthUrl } from '../oauthBrowser';

jest.mock('../platform', () => ({
  isNativeApp: () => false,
}));

describe('oauthBrowser', () => {
  it('falls back to location navigation on non-native', async () => {
    const original = window.location;
    delete window.location;
    window.location = { href: '' };
    await openOAuthUrl('https://example.com/oauth');
    expect(window.location.href).toBe('https://example.com/oauth');
    window.location = original;
  });
});