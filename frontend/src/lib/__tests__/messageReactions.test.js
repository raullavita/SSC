import {
  applyMessageReactionUpdate,
  canReactToMessage,
  groupReactionsForDisplay,
  myReactionForMessage,
} from '../messageReactions';

describe('messageReactions', () => {
  it('allows reactions on non-deleted messages', () => {
    expect(canReactToMessage({ message_type: 'text' })).toBe(true);
    expect(canReactToMessage({ message_type: 'deleted', deleted_for_everyone_at: 'x' })).toBe(false);
  });

  it('finds my reaction', () => {
    const reactions = [
      { user_id: 'u_me', emoji: '👍' },
      { user_id: 'u_peer', emoji: '❤️' },
    ];
    expect(myReactionForMessage(reactions, 'u_me')).toBe('👍');
    expect(myReactionForMessage(reactions, 'u_other')).toBeNull();
  });

  it('groups reactions for display', () => {
    const grouped = groupReactionsForDisplay([
      { user_id: 'u_me', emoji: '👍' },
      { user_id: 'u_peer', emoji: '👍' },
      { user_id: 'u_a', emoji: '❤️' },
    ], 'u_me');
    expect(grouped.find((g) => g.emoji === '👍')?.count).toBe(2);
    expect(grouped.find((g) => g.emoji === '👍')?.mine).toBe(true);
  });

  it('applies reaction payload to thread', () => {
    const messages = [
      { message_id: 'm_1', reactions: [] },
      { message_id: 'm_2', reactions: [] },
    ];
    const next = applyMessageReactionUpdate(messages, {
      message_id: 'm_1',
      reactions: [{ user_id: 'u_me', emoji: '😂' }],
    });
    expect(next[0].reactions).toHaveLength(1);
    expect(next[1].reactions).toHaveLength(0);
  });
});