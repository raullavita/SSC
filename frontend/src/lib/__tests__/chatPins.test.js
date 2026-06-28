import { sortSidebarConversations } from '../chatPins';

describe('chatPins', () => {
  it('sorts pinned chats first by pinned_at desc', () => {
    const convs = [
      { conversation_id: 'c1', pinned: false, created_at: '2026-06-29T10:00:00+00:00' },
      { conversation_id: 'c2', pinned: true, pinned_at: '2026-06-29T09:00:00+00:00' },
      { conversation_id: 'c3', pinned: true, pinned_at: '2026-06-29T11:00:00+00:00' },
      { conversation_id: 'c4', pinned: false, last_activity_at: '2026-06-29T12:00:00+00:00' },
    ];
    expect(sortSidebarConversations(convs).map((c) => c.conversation_id)).toEqual([
      'c3',
      'c2',
      'c4',
      'c1',
    ]);
  });
});