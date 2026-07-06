/** Quick-reaction emoji palette (matches MessageBubble / ReactionPicker). */

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const QUICK_REACTION_EMOJI = '👍';

export function isAllowedReactionEmoji(emoji) {
  return typeof emoji === 'string' && emoji.length > 0 && emoji.length <= 8;
}