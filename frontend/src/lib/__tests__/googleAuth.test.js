import { googleAuthEnabled } from '../googleAuth';

describe('googleAuth', () => {
  it('reports whether google auth is configured', () => {
    expect(typeof googleAuthEnabled()).toBe('boolean');
  });
});