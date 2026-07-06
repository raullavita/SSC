import { parseReactionText } from '../reactions';
import { isAllowedReactionEmoji, REACTION_EMOJIS } from '../reactionEmojis';

describe('reactions', () => {
  test('parseReactionText extracts emoji and target', () => {
    const parsed = parseReactionText(JSON.stringify({ emoji: '👍', target: 'msg_abc' }));
    expect(parsed).toEqual({ emoji: '👍', target: 'msg_abc' });
  });

  test('parseReactionText rejects invalid payload', () => {
    expect(parseReactionText('hello')).toBeNull();
    expect(parseReactionText(JSON.stringify({ emoji: '👍' }))).toBeNull();
  });

  test('REACTION_EMOJIS palette is stable', () => {
    expect(REACTION_EMOJIS).toHaveLength(6);
    expect(REACTION_EMOJIS[0]).toBe('👍');
  });

  test('isAllowedReactionEmoji validates length', () => {
    expect(isAllowedReactionEmoji('👍')).toBe(true);
    expect(isAllowedReactionEmoji('')).toBe(false);
    expect(isAllowedReactionEmoji('x'.repeat(9))).toBe(false);
  });
});