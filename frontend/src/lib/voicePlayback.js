/** Voice note scrubber + playback speed — Q.20 */

export const VOICE_PLAYBACK_SPEEDS = [1, 1.5, 2];

export function cyclePlaybackSpeed(current) {
  const idx = VOICE_PLAYBACK_SPEEDS.indexOf(current);
  const next = idx < 0 ? 0 : (idx + 1) % VOICE_PLAYBACK_SPEEDS.length;
  return VOICE_PLAYBACK_SPEEDS[next];
}

export function formatVoiceTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function scrubberSeekRatio(clientX, rect) {
  if (!rect?.width) return 0;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.min(1, Math.max(0, ratio));
}

export function seekTimeFromRatio(duration, ratio) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, duration * ratio));
}

export function formatPlaybackSpeedLabel(speed) {
  if (speed === 1) return '1×';
  if (speed === 1.5) return '1.5×';
  if (speed === 2) return '2×';
  return `${speed}×`;
}