import {
  isSiteUnderConstruction,
  isSitePublicConstructionMode,
  isSitePreviewGateEnabled,
  hasSiteAccessBypass,
  setSiteAccessBypass,
  verifySitePreviewPassword,
  tryUrlPreviewBypass,
  isSitePreviewLocked,
} from '../siteGate';

describe('siteGate', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    delete window.location;
    window.location = new URL('https://www.supersecurechat.com/');
    process.env.REACT_APP_SITE_PREVIEW_PASSWORD = 'invite-only-code';
    delete process.env.REACT_APP_SITE_PREVIEW_KEY;
  });

  it('defaults to under construction in production when env unset', () => {
    const prev = process.env.REACT_APP_SITE_UNDER_CONSTRUCTION;
    delete process.env.REACT_APP_SITE_UNDER_CONSTRUCTION;
    process.env.NODE_ENV = 'production';
    expect(isSiteUnderConstruction()).toBe(true);
    expect(isSitePublicConstructionMode()).toBe(true);
    process.env.REACT_APP_SITE_UNDER_CONSTRUCTION = prev;
  });

  it('disables preview password gate unless explicitly enabled', () => {
    process.env.REACT_APP_SITE_PREVIEW_PASSWORD = 'invite-only-code';
    delete process.env.REACT_APP_SITE_PREVIEW_GATE;
    expect(isSitePreviewGateEnabled()).toBe(false);
    process.env.REACT_APP_SITE_PREVIEW_GATE = 'true';
    expect(isSitePreviewGateEnabled()).toBe(true);
  });

  it('stores and reads bypass in session storage', () => {
    expect(hasSiteAccessBypass()).toBe(false);
    setSiteAccessBypass();
    expect(hasSiteAccessBypass()).toBe(true);
  });

  it('rejects wrong password and accepts correct password', () => {
    expect(verifySitePreviewPassword('wrong')).toBe(false);
    expect(verifySitePreviewPassword('invite-only-code')).toBe(true);
  });

  it('locks after repeated failures', () => {
    for (let i = 0; i < 5; i += 1) verifySitePreviewPassword('wrong');
    expect(isSitePreviewLocked()).toBe(true);
    expect(verifySitePreviewPassword('invite-only-code')).toBe(false);
  });

  it('accepts bookmark access param when password matches', () => {
    window.location = new URL('https://www.supersecurechat.com/?access=invite-only-code');
    expect(tryUrlPreviewBypass()).toBe(true);
    expect(hasSiteAccessBypass()).toBe(true);
  });
});