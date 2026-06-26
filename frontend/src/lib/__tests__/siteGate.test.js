import {
  isSiteUnderConstruction,
  hasSiteAccessBypass,
  setSiteAccessBypass,
  tryUrlPreviewBypass,
} from '../siteGate';

describe('siteGate', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    delete window.location;
    window.location = new URL('https://www.supersecurechat.com/');
  });

  it('defaults to under construction in production when env unset', () => {
    const prev = process.env.REACT_APP_SITE_UNDER_CONSTRUCTION;
    delete process.env.REACT_APP_SITE_UNDER_CONSTRUCTION;
    process.env.NODE_ENV = 'production';
    expect(isSiteUnderConstruction()).toBe(true);
    process.env.REACT_APP_SITE_UNDER_CONSTRUCTION = prev;
  });

  it('stores and reads bypass in session storage', () => {
    expect(hasSiteAccessBypass()).toBe(false);
    setSiteAccessBypass();
    expect(hasSiteAccessBypass()).toBe(true);
  });

  it('accepts preview query param when key matches', () => {
    process.env.REACT_APP_SITE_PREVIEW_KEY = 'ssc-preview';
    window.location = new URL('https://www.supersecurechat.com/?preview=ssc-preview');
    expect(tryUrlPreviewBypass()).toBe(true);
    expect(hasSiteAccessBypass()).toBe(true);
  });
});