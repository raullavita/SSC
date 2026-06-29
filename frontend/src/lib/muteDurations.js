/** Per-chat mute duration presets — Q.44 */

export const MUTE_DURATIONS = [
  { id: '1h', hours: 1, labelKey: 'muteDuration1h' },
  { id: '8h', hours: 8, labelKey: 'muteDuration8h' },
  { id: '24h', hours: 24, labelKey: 'muteDuration24h' },
  { id: '1w', hours: 168, labelKey: 'muteDuration1w' },
  { id: 'forever', hours: null, labelKey: 'muteDurationForever' },
];

export function isConversationMuted(conversation) {
  return !!conversation?.muted;
}

export function formatMuteRemaining(mutedUntil, t) {
  if (!mutedUntil) return t('muteDurationForever');
  const end = new Date(mutedUntil).getTime();
  const diff = end - Date.now();
  if (diff <= 0) return null;
  const hours = Math.ceil(diff / (60 * 60 * 1000));
  if (hours < 24) {
    return t('muteRemainingHours', { n: hours });
  }
  const days = Math.ceil(hours / 24);
  return t('muteRemainingDays', { n: days });
}

export function muteLabelForConversation(conversation, t) {
  if (!conversation?.muted) return null;
  const remaining = formatMuteRemaining(conversation.muted_until, t);
  if (!remaining) return t('muted');
  return `${t('muted')} · ${remaining}`;
}