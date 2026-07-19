import { formatListTime } from '../formatListTime';

describe('formatListTime', () => {
  test('returns empty for invalid', () => {
    expect(formatListTime(null)).toBe('');
    expect(formatListTime('not-a-date')).toBe('');
  });

  test('formats today as time', () => {
    const now = new Date();
    const label = formatListTime(now.toISOString());
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('Yesterday');
  });

  test('formats yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(15, 30, 0, 0);
    expect(formatListTime(d.toISOString())).toBe('Yesterday');
  });
});
