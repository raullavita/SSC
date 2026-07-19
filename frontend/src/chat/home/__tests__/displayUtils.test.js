import {
  avatarHue,
  conversationLabel,
  filterConversations,
  getInitials,
  getThreadTitle,
  sortConversations,
} from '../displayUtils';

describe('displayUtils', () => {
  test('getInitials', () => {
    expect(getInitials('Raul Albert')).toBe('RA');
    expect(getInitials('Raul')).toBe('RA');
    expect(getInitials('')).toBe('?');
  });

  test('conversationLabel', () => {
    expect(conversationLabel({ type: 'group', group_id: 'g1' })).toBe('g1');
    expect(conversationLabel({ peer_id: 'peer-9' })).toBe('peer-9');
  });

  test('sortConversations pins first then by updated_at', () => {
    const list = [
      { id: 'a', pinned: false, updated_at: '2026-01-02T00:00:00Z' },
      { id: 'b', pinned: true, updated_at: '2026-01-01T00:00:00Z' },
      { id: 'c', pinned: false, updated_at: '2026-01-03T00:00:00Z' },
    ];
    expect(sortConversations(list).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  test('filterConversations', () => {
    const list = [
      { id: '1', peer_id: 'alice' },
      { id: '2', type: 'group', group_id: 'team' },
    ];
    expect(filterConversations(list, 'ali')).toHaveLength(1);
    expect(filterConversations(list, 'team')[0].id).toBe('2');
  });

  test('getThreadTitle', () => {
    expect(
      getThreadTitle(
        { type: 'group', group_id: 'abc' },
        { isGroup: true }
      )
    ).toBe('Group abc');
    expect(
      getThreadTitle(
        { peer_id: 'peer-xyz' },
        {
          isGroup: false,
          nameForId: (id) => (id === 'peer-xyz' ? 'Alice' : id),
          userId: 'me',
        }
      )
    ).toBe('Alice');
  });

  test('avatarHue is stable', () => {
    expect(avatarHue('user-1')).toBe(avatarHue('user-1'));
    expect(avatarHue('user-1')).not.toBe(avatarHue('user-2'));
  });
});
