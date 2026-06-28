import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import {
  cyclePlaybackSpeed,
  formatPlaybackSpeedLabel,
  formatVoiceTime,
  scrubberSeekRatio,
  seekTimeFromRatio,
} from '../lib/voicePlayback';

export default function VoiceNotePlayer({ objectUrl, fileId }) {
  const { t } = useLocale();
  const audioRef = useRef(null);
  const scrubRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    el.playbackRate = playbackSpeed;
    return undefined;
  }, [playbackSpeed, objectUrl]);

  const onLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setDuration(Number.isFinite(el.duration) ? el.duration : 0);
  }, []);

  const onTimeUpdate = useCallback(() => {
    if (seeking) return;
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
  }, [seeking]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const seekToRatio = useCallback((ratio) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const next = seekTimeFromRatio(el.duration, ratio);
    el.currentTime = next;
    setCurrentTime(next);
  }, []);

  const onScrubInput = useCallback((e) => {
    const ratio = Number(e.target.value) / 1000;
    seekToRatio(ratio);
  }, [seekToRatio]);

  const onScrubPointerDown = useCallback(() => {
    setSeeking(true);
  }, []);

  const onScrubPointerUp = useCallback((e) => {
    setSeeking(false);
    onScrubInput(e);
  }, [onScrubInput]);

  const onScrubTrackClick = useCallback((e) => {
    if (!scrubRef.current) return;
    const ratio = scrubberSeekRatio(e.clientX, scrubRef.current.getBoundingClientRect());
    seekToRatio(ratio);
  }, [seekToRatio]);

  const onSpeedClick = useCallback(() => {
    setPlaybackSpeed((speed) => cyclePlaybackSpeed(speed));
  }, []);

  const progress = duration > 0 ? Math.min(1000, Math.round((currentTime / duration) * 1000)) : 0;

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px] max-w-[280px]" data-testid={`voice-${fileId}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-[#00E5FF] text-black flex items-center justify-center shrink-0 hover:brightness-110"
          data-testid={`voice-play-${fileId}`}
          aria-label={playing ? t('voicePause') : t('voicePlay')}
        >
          {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            ref={scrubRef}
            className="relative h-6 flex items-center cursor-pointer"
            onClick={onScrubTrackClick}
            data-testid={`voice-scrubber-${fileId}`}
          >
            <div className="absolute inset-x-0 h-1 rounded-full bg-[#27272A]" />
            <div
              className="absolute left-0 h-1 rounded-full bg-[#00E5FF] pointer-events-none"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
            <input
              type="range"
              min={0}
              max={1000}
              value={progress}
              onChange={onScrubInput}
              onPointerDown={onScrubPointerDown}
              onPointerUp={onScrubPointerUp}
              className="voice-scrubber-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              data-testid={`voice-scrubber-input-${fileId}`}
              aria-label={t('voiceScrubber')}
            />
          </div>
          <div className="flex items-center justify-between mt-0.5 text-[10px] font-mono text-[#A1A1AA] tracking-wider">
            <span data-testid={`voice-time-${fileId}`}>
              {formatVoiceTime(currentTime)}
              {' / '}
              {formatVoiceTime(duration)}
            </span>
            <button
              type="button"
              onClick={onSpeedClick}
              className="px-1.5 py-0.5 rounded tac-border bg-[#1A1A1A] hover:bg-[#232323] text-[#00E5FF]"
              data-testid={`voice-speed-${fileId}`}
              title={t('voicePlaybackSpeed', { speed: formatPlaybackSpeedLabel(playbackSpeed) })}
            >
              {formatPlaybackSpeedLabel(playbackSpeed)}
            </button>
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={objectUrl}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        data-testid={`voice-audio-${fileId}`}
      />
    </div>
  );
}