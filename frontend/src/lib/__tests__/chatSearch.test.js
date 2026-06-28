import {
  clampSearchMatchIndex,
  filterMessagesForSearch,
  messageMatchesQuery,
  searchMatchIds,
  splitTextForHighlight,
} from '../chatSearch';

describe('chatSearch', () => {
  const context = {
    user: { user_id: 'u_me', username: 'alice' },
    peer: { user_id: 'u_peer', username: 'bob' },
    isGroup: false,
  };
  const bodies = {
    m1: 'Hello world',
    m2: 'Secret plans tonight',
  };
  const messages = [
    { message_id: 'm1', sender_id: 'u_me', message_type: 'text' },
    { message_id: 'm2', sender_id: 'u_peer', message_type: 'text' },
    { message_id: 'm3', sender_id: 'u_peer', message_type: 'deleted', deleted_for_everyone_at: 'x' },
  ];

  it('matches decrypted body text', () => {
    expect(messageMatchesQuery(messages[1], 'plans', bodies, context)).toBe(true);
    expect(messageMatchesQuery(messages[1], 'missing', bodies, context)).toBe(false);
  });

  it('matches sender username', () => {
    expect(messageMatchesQuery(messages[1], 'bob', bodies, context)).toBe(true);
  });

  it('skips deleted messages', () => {
    expect(messageMatchesQuery(messages[2], 'deleted', bodies, context)).toBe(false);
  });

  it('filters and returns ordered match ids', () => {
    const filtered = filterMessagesForSearch(messages, 'hello', bodies, context);
    expect(filtered.map((m) => m.message_id)).toEqual(['m1']);
    expect(searchMatchIds(messages, 'bob', bodies, context)).toEqual(['m2']);
  });

  it('splits text for highlight spans', () => {
    expect(splitTextForHighlight('Hello world', 'world')).toEqual([
      { text: 'Hello ', match: false },
      { text: 'world', match: true },
    ]);
  });

  it('wraps match index in range', () => {
    expect(clampSearchMatchIndex(3, 2)).toBe(1);
    expect(clampSearchMatchIndex(-1, 3)).toBe(2);
    expect(clampSearchMatchIndex(0, 0)).toBe(0);
  });
});