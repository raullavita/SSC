import { needsUsernameSetup, postAuthPath } from '../onboarding';

describe('onboarding', () => {
  it('requires username when missing', () => {
    expect(needsUsernameSetup({ id: 'u_1' })).toBe(true);
    expect(needsUsernameSetup({ id: 'u_1', username: 'alice' })).toBe(false);
  });

  it('routes new users to setup', () => {
    expect(postAuthPath({ id: 'u_1' })).toBe('/setup-username');
    expect(postAuthPath({ id: 'u_1', username: 'bob' })).toBe('/chat');
    expect(postAuthPath({ id: 'u_1', username: 'bob' }, '/add/alice')).toBe('/add/alice');
  });
});