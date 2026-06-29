import {
  MUTE_DURATIONS,
  formatMuteRemaining,
  isConversationMuted,
  muteLabelForConversation,
} from '../muteDurations';

describe('muteDurations', () => {
  const t = (key, vars) => {
    if (key === 'muteRemainingHours') return `${vars.n}h left`;
    if (key === 'muteRemainingDays') return `${vars.n}d left`;
    if (key === 'muteDurationForever') return 'Until I turn it back on';
    if (key === 'muted') return 'muted';
    return key;
  };

  it('lists standard duration presets', () => {
    expect(MUTE_DURATIONS.map((d) => d.id)).toEqual(['1h', '8h', '24h', '1w', 'forever']);
  });

  it('detects muted conversations', () => {
    expect(isConversationMuted({ muted: true })).toBe(true);
    expect(isConversationMuted({ muted: false })).toBe(false);
  });

  it('formats remaining mute time', () => {
    const until = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    expect(formatMuteRemaining(until, t)).toBe('3h left');
    expect(formatMuteRemaining(null, t)).toBe('Until I turn it back on');
  });

  it('builds sidebar mute label', () => {
    const until = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(muteLabelForConversation({ muted: true, muted_until: until }, t)).toContain('muted');
  });
});