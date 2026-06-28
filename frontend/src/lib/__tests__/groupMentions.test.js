import {
  filterMentionCandidates,
  getActiveMentionAtCursor,
  insertMentionAt,
  resolveMentionedUserIds,
  splitTextForMentions,
} from '../groupMentions';

const members = [
  { user_id: 'u_me', username: 'alice' },
  { user_id: 'u_bobby', username: 'bobby' },
  { user_id: 'u_carol', username: 'carol' },
];

describe('groupMentions', () => {
  it('detects active mention at cursor', () => {
    expect(getActiveMentionAtCursor('hey @bo', 7, members)).toEqual({ query: 'bo', startIndex: 4 });
    expect(getActiveMentionAtCursor('hey @bobby ok', 11, members)).toBeNull();
  });

  it('filters mention candidates', () => {
    const out = filterMentionCandidates('ca', members, 'u_me');
    expect(out.map((m) => m.username)).toEqual(['carol']);
  });

  it('inserts mention token', () => {
    expect(insertMentionAt('hey @ca', 4, 'carol')).toBe('hey @carol ');
  });

  it('resolves mentioned user ids from text', () => {
    expect(resolveMentionedUserIds('hi @bobby and @carol', members)).toEqual(['u_bobby', 'u_carol']);
    expect(resolveMentionedUserIds('hi @bobby and @bobby', members)).toEqual(['u_bobby']);
  });

  it('splits text for mention rendering', () => {
    const parts = splitTextForMentions('hi @bobby!', members);
    expect(parts).toEqual([
      { text: 'hi ', isMention: false },
      { text: '@bobby', isMention: true, username: 'bobby', userId: 'u_bobby' },
      { text: '!', isMention: false },
    ]);
  });
});