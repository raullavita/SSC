import { extractOAuthCode, isGoogleOAuthReturn, shouldUseGoogleRedirect } from '../googleAuth';

describe('googleAuth', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete window.location;
    window.location = { pathname: '/', search: '', hash: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('detects oauth return on /auth/google path', () => {
    window.location = { pathname: '/auth/google', search: '?oauth_code=abc', hash: '' };
    expect(isGoogleOAuthReturn()).toBe(true);
    expect(extractOAuthCode()).toBe('abc');
  });

  it('detects oauth return on Android pathname+search', () => {
    window.location = { pathname: '/auth/google', search: '?oauth_code=xyz', hash: '' };
    expect(isGoogleOAuthReturn()).toBe(true);
  });

  it('extracts code from hash router', () => {
    window.location = { pathname: '/auth/google', search: '', hash: '#oauth_code=hashcode' };
    expect(extractOAuthCode()).toBe('hashcode');
  });

  it('extracts code from hash-router path query', () => {
    window.location = {
      pathname: '/index.html',
      search: '',
      hash: '#/auth/google?oauth_code=fromhash',
    };
    expect(extractOAuthCode()).toBe('fromhash');
  });

  it('uses redirect flow for installed electron runtime', () => {
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.0/4';
    expect(shouldUseGoogleRedirect()).toBe(true);
    delete window.__SSC_ELECTRON_CLIENT;
  });
});