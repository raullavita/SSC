import { partitionSidebarConversations, sortArchivedConversations } from '../chatArchives';

describe('chatArchives', () => {
  it('partitions active and archived chats', () => {
    const convs = [
      { conversation_id: 'c1', archived: false },
      { conversation_id: 'c2', archived: true, archived_at: '2026-06-29T09:00:00+00:00' },
      { conversation_id: 'c3', archived: true, archived_at: '2026-06-29T11:00:00+00:00' },
    ];
    const { active, archived } = partitionSidebarConversations(convs);
    expect(active.map((c) => c.conversation_id)).toEqual(['c1']);
    expect(archived.map((c) => c.conversation_id)).toEqual(['c2', 'c3']);
  });

  it('sorts archived chats by archived_at desc', () => {
    const convs = [
      { conversation_id: 'c1', archived: true, archived_at: '2026-06-29T09:00:00+00:00' },
      { conversation_id: 'c2', archived: true, archived_at: '2026-06-29T11:00:00+00:00' },
    ];
    expect(sortArchivedConversations(convs).map((c) => c.conversation_id)).toEqual(['c2', 'c1']);
  });
});