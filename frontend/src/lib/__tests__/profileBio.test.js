import {
  BIO_MAX_LEN,
  bioPreviewLine,
  normalizeProfileBioInput,
  userBio,
} from '../profileBio';

describe('profileBio', () => {
  it('reads bio from user', () => {
    expect(userBio({ bio: '  Builder  ' })).toBe('Builder');
    expect(userBio({})).toBeNull();
  });

  it('builds single-line preview', () => {
    expect(bioPreviewLine('Line one\nLine two')).toBe('Line one Line two');
    expect(bioPreviewLine('x'.repeat(90), 80)).toMatch(/…$/);
  });

  it('validates bio input', () => {
    expect(normalizeProfileBioInput('  Hello\nworld  ')).toBe('Hello\nworld');
    expect(normalizeProfileBioInput('')).toBeNull();
    expect(() => normalizeProfileBioInput('a\x00b')).toThrow(/INVALID/);
    expect(() => normalizeProfileBioInput('x'.repeat(BIO_MAX_LEN + 1))).toThrow(/LONG/);
  });

  it('collapses excess newlines', () => {
    expect(normalizeProfileBioInput('a\n\n\n\nb')).toBe('a\n\nb');
  });
});