import {
  formatUserLabel,
  normalizeDisplayNameInput,
  userInitials,
  userPrimaryLabel,
} from '../displayName';

describe('displayName', () => {
  it('prefers display name over username', () => {
    expect(userPrimaryLabel({ username: 'alex_x', display_name: 'Alex' })).toBe('Alex');
    expect(formatUserLabel({ username: 'alex_x', display_name: 'Alex' })).toBe('Alex (@alex_x)');
  });

  it('falls back to @username', () => {
    expect(userPrimaryLabel({ username: 'alex_x' })).toBe('@alex_x');
  });

  it('builds initials from display name words', () => {
    expect(userInitials({ username: 'alex_x', display_name: 'Alex Kim' })).toBe('AK');
    expect(userInitials({ username: 'alex_x', display_name: 'Alex' })).toBe('AL');
    expect(userInitials({ username: 'alex_x' })).toBe('AL');
  });

  it('validates display name input', () => {
    expect(normalizeDisplayNameInput('  Alex  ')).toBe('Alex');
    expect(normalizeDisplayNameInput('')).toBeNull();
    expect(() => normalizeDisplayNameInput('a@b')).toThrow(/AT/);
    expect(() => normalizeDisplayNameInput('x'.repeat(49))).toThrow(/LONG/);
  });
});