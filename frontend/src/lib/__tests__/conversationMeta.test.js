import {
  bumpUnread,
  mergeConversationMeta,
  patchConversationInList,
} from '../conversationMeta';

describe('conversationMeta helpers', () => {
  it('merges detail metadata onto a list row', () => {
    const merged = mergeConversationMeta(
      { id: 'c1', peer_id: 'u2', unread_count: 2 },
      { id: 'c1', pinned: true, unread_count: 0, updated_at: '2026-07-06T12:00:00Z' }
    );
    expect(merged).toEqual({
      id: 'c1',
      peer_id: 'u2',
      pinned: true,
      unread_count: 0,
      updated_at: '2026-07-06T12:00:00Z',
    });
  });

  it('patches a conversation in a list', () => {
    const next = patchConversationInList(
      [
        { id: 'c1', muted: false, unread_count: 1 },
        { id: 'c2', muted: false, unread_count: 0 },
      ],
      { id: 'c1', muted: true, unread_count: 0 }
    );
    expect(next[0]).toMatchObject({ id: 'c1', muted: true, unread_count: 0 });
    expect(next[1].id).toBe('c2');
  });

  it('bumps unread and updates timestamp', () => {
    const bumped = bumpUnread({ id: 'c1', unread_count: 1 }, { updatedAt: '2026-07-06T13:00:00Z' });
    expect(bumped.unread_count).toBe(2);
    expect(bumped.updated_at).toBe('2026-07-06T13:00:00Z');
  });
});