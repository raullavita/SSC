import { formatReadReceiptLabel, indexReadsByMessage } from '../readReceipts';

describe('readReceipts', () => {
  it('indexes multiple reads per message', () => {
    const map = indexReadsByMessage([
      { message_id: 'm1', read_at: '2026-01-01T00:00:00Z' },
      { message_id: 'm1', read_at: '2026-01-02T00:00:00Z' },
      { message_id: 'm2', read_at: '2026-01-03T00:00:00Z' },
    ]);
    expect(map.m1).toHaveLength(2);
    expect(map.m2).toHaveLength(1);
  });

  it('formats single and multi reader labels', () => {
    expect(formatReadReceiptLabel([])).toBe('');
    expect(formatReadReceiptLabel(['2026-01-01T12:00:00Z'])).toContain('Read');
    expect(formatReadReceiptLabel(['a', 'b'])).toBe('Read by 2');
  });
});