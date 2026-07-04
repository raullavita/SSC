import { formatPresenceBucket } from '../presence';

describe('presence', () => {
  test('formatPresenceBucket hides unknown', () => {
    expect(formatPresenceBucket('hidden')).toBe('');
    expect(formatPresenceBucket('online')).toBe('Online');
    expect(formatPresenceBucket('recently')).toBe('Recently active');
  });
});