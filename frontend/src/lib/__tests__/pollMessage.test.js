import {
  applyPollVoteUpdate,
  buildPollPayload,
  myPollVote,
  parsePollPayload,
  pollVoteStats,
  serializePollPayload,
} from '../pollMessage';

describe('pollMessage', () => {
  it('serializes and parses poll payload', () => {
    const raw = serializePollPayload({ question: 'Lunch?', options: ['Pizza', 'Sushi'] });
    expect(parsePollPayload(raw)).toEqual({ question: 'Lunch?', options: ['Pizza', 'Sushi'] });
  });

  it('validates poll payload', () => {
    expect(buildPollPayload({ question: '', options: ['a', 'b'] }).ok).toBe(false);
    expect(buildPollPayload({ question: 'Q', options: ['a'] }).ok).toBe(false);
    expect(buildPollPayload({ question: 'Q', options: ['a', 'a'] }).ok).toBe(false);
    expect(buildPollPayload({ question: 'Q', options: ['a', 'b'] }).ok).toBe(true);
  });

  it('computes vote stats and mine', () => {
    const votes = [
      { user_id: 'u_me', option_index: 1 },
      { user_id: 'u_peer', option_index: 0 },
      { user_id: 'u_other', option_index: 1 },
    ];
    expect(myPollVote(votes, 'u_me')).toBe(1);
    expect(pollVoteStats(votes, 2)).toEqual({ counts: [1, 2], total: 3 });
  });

  it('applies poll vote websocket update', () => {
    const next = applyPollVoteUpdate(
      [{ message_id: 'm_1', poll_votes: [] }],
      { message_id: 'm_1', poll_votes: [{ user_id: 'u_me', option_index: 0 }] },
    );
    expect(next[0].poll_votes).toHaveLength(1);
  });
});