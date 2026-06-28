import {
  cyclePlaybackSpeed,
  formatPlaybackSpeedLabel,
  formatVoiceTime,
  scrubberSeekRatio,
  seekTimeFromRatio,
} from '../voicePlayback';

describe('voicePlayback', () => {
  it('formats elapsed time', () => {
    expect(formatVoiceTime(0)).toBe('0:00');
    expect(formatVoiceTime(65.4)).toBe('1:05');
  });

  it('cycles playback speed', () => {
    expect(cyclePlaybackSpeed(1)).toBe(1.5);
    expect(cyclePlaybackSpeed(1.5)).toBe(2);
    expect(cyclePlaybackSpeed(2)).toBe(1);
  });

  it('computes scrubber seek ratio', () => {
    expect(scrubberSeekRatio(50, { left: 0, width: 100 })).toBe(0.5);
    expect(scrubberSeekRatio(-10, { left: 0, width: 100 })).toBe(0);
  });

  it('maps ratio to seek time', () => {
    expect(seekTimeFromRatio(120, 0.25)).toBe(30);
  });

  it('formats speed labels', () => {
    expect(formatPlaybackSpeedLabel(1.5)).toBe('1.5×');
  });
});