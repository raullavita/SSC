import {
  buildSearchSnippet,
  filterVisibleChatMessages,
  mergeGlobalSearchResults,
  searchGlobalInConversation,
} from '../globalMessageSearch';
import { SKDM_MESSAGE_TYPE } from '../signal/constants';

describe('globalMessageSearch', () => {
  const user = { user_id: 'u_me', username: 'alice' };
  const conversation = {
    conversation_id: 'c1',
    is_group: false,
    peer: { user_id: 'u_peer', username: 'bob' },
  };
  const messages = [
    { message_id: 'm1', sender_id: 'u_me', created_at: '2026-06-29T10:00:00+00:00', message_type: 'text' },
    { message_id: 'm2', sender_id: 'u_peer', created_at: '2026-06-29T11:00:00+00:00', message_type: 'text' },
  ];
  const bodies = {
    m1: 'Hello world',
    m2: 'Dinner plans tonight',
  };

  it('filters protocol housekeeping messages', () => {
    const raw = [
      { message_type: 'text' },
      { message_type: SKDM_MESSAGE_TYPE },
    ];
    expect(filterVisibleChatMessages(raw)).toHaveLength(1);
  });

  it('builds snippet around query match', () => {
    const snippet = buildSearchSnippet('The quick brown fox jumps', 'brown');
    expect(snippet).toContain('brown');
  });

  it('searches within a conversation', () => {
    const hits = searchGlobalInConversation({
      conversation,
      messages,
      decryptedBodies: bodies,
      query: 'dinner',
      user,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].message_id).toBe('m2');
    expect(hits[0].conversation_id).toBe('c1');
  });

  it('merges and sorts results by created_at desc', () => {
    const merged = mergeGlobalSearchResults([
      [{ message_id: 'm1', created_at: '2026-06-29T09:00:00+00:00' }],
      [{ message_id: 'm2', created_at: '2026-06-29T12:00:00+00:00' }],
    ]);
    expect(merged.map((r) => r.message_id)).toEqual(['m2', 'm1']);
  });
});