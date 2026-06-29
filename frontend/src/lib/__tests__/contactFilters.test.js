import {
  visibleConversations,
  isPeerBlocked,
  isPeerMuted,
  isConversationMuted,
} from '../contactFilters';

describe('contactFilters', () => {
  const contacts = [
    { user_id: 'u1', username: 'alice', blocked: false, muted: false },
    { user_id: 'u2', username: 'bob', blocked: true, muted: false },
    { user_id: 'u3', username: 'carol', blocked: false, muted: true },
  ];

  it('hides 1:1 with blocked peer', () => {
    const convs = [
      { conversation_id: 'c1', is_group: false, peer: { user_id: 'u2' } },
      { conversation_id: 'c2', is_group: false, peer: { user_id: 'u1' } },
      { conversation_id: 'g1', is_group: true, members: [] },
    ];
    const visible = visibleConversations(convs, contacts);
    expect(visible.map((c) => c.conversation_id)).toEqual(['c2', 'g1']);
  });

  it('detects conversation mute from conv or contact fallback', () => {
    expect(isConversationMuted({ muted: true, is_group: true })).toBe(true);
    expect(isConversationMuted(
      { is_group: false, peer: { user_id: 'u3' } },
      contacts,
    )).toBe(true);
    expect(isConversationMuted(
      { is_group: false, peer: { user_id: 'u1' } },
      contacts,
    )).toBe(false);
  });

  it('detects blocked and muted peers', () => {
    expect(isPeerBlocked('u2', contacts)).toBe(true);
    expect(isPeerMuted('u3', contacts)).toBe(true);
    expect(isPeerBlocked('u1', contacts)).toBe(false);
  });
});