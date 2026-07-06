import {
  formatReadReceiptDetail,
  formatReadReceiptLabel,
  indexReadsByMessage,
} from '../readReceipts';

describe('readReceipts', () => {
  const nameForId = (id) => {
    if (id === 'u_alice') return 'Alice';
    if (id === 'u_bob') return 'Bob';
    if (id === 'u_carol') return 'Carol';
    return id;
  };

  it('indexes multiple readers per message', () => {
    const map = indexReadsByMessage([
      { message_id: 'm1', reader_id: 'u_alice', read_at: '2026-01-01T00:00:00Z' },
      { message_id: 'm1', reader_id: 'u_bob', read_at: '2026-01-02T00:00:00Z' },
      { message_id: 'm2', reader_id: 'u_alice', read_at: '2026-01-03T00:00:00Z' },
    ]);
    expect(map.m1).toHaveLength(2);
    expect(map.m1[0].readerId).toBe('u_alice');
    expect(map.m2).toHaveLength(1);
  });

  it('dedupes readers keeping latest read_at', () => {
    const map = indexReadsByMessage([
      { message_id: 'm1', reader_id: 'u_alice', read_at: '2026-01-01T00:00:00Z' },
      { message_id: 'm1', reader_id: 'u_alice', read_at: '2026-01-05T00:00:00Z' },
    ]);
    expect(map.m1).toHaveLength(1);
    expect(map.m1[0].readAt).toBe('2026-01-05T00:00:00Z');
  });

  it('formats group labels with names', () => {
    const readers = [
      { readerId: 'u_alice', readAt: '2026-01-01T12:00:00Z' },
      { readerId: 'u_bob', readAt: '2026-01-01T12:01:00Z' },
    ];
    expect(formatReadReceiptLabel(readers, { isGroup: true, nameForId })).toBe(
      'Read by Alice and Bob'
    );
  });

  it('formats three group readers', () => {
    const readers = [
      { readerId: 'u_alice', readAt: '1' },
      { readerId: 'u_bob', readAt: '2' },
      { readerId: 'u_carol', readAt: '3' },
    ];
    expect(formatReadReceiptLabel(readers, { isGroup: true, nameForId })).toBe(
      'Read by Alice, Bob, and Carol'
    );
  });

  it('formatReadReceiptDetail returns expandable entries', () => {
    const detail = formatReadReceiptDetail(
      [
        { readerId: 'u_alice', readAt: '2026-01-01T12:00:00Z' },
        { readerId: 'u_bob', readAt: '2026-01-01T12:05:00Z' },
      ],
      { isGroup: true, nameForId }
    );
    expect(detail.short).toBe('Read by Alice and Bob');
    expect(detail.entries).toHaveLength(2);
    expect(detail.entries[0].name).toBe('Alice');
  });
});