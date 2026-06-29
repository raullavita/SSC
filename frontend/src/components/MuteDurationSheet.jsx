import React, { useEffect } from 'react';
import { X, Bell, BellSlash } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { MUTE_DURATIONS, formatMuteRemaining } from '../lib/muteDurations';

/**
 * Pick how long to mute a chat (1h / 8h / 24h / 1w / forever) — Q.44.
 */
export default function MuteDurationSheet({
  open,
  title,
  muted,
  mutedUntil,
  onClose,
  onMute,
  onUnmute,
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const remaining = muted ? formatMuteRemaining(mutedUntil, t) : null;

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center safe-bottom"
      onClick={onClose}
      data-testid="mute-duration-sheet"
    >
      <div
        className="w-full max-w-sm bg-[#121212] tac-border rounded-t-md md:rounded-md p-5 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.2em] truncate pr-2">
            {muted ? t('muteNotifications') : t('muteChat')}
          </h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" aria-label={t('close')}>
            <X size={16} />
          </button>
        </div>

        {title && (
          <p className="text-sm text-[#D4D4D8] mb-3 truncate">{title}</p>
        )}

        {muted && (
          <div className="mb-4 px-3 py-2 rounded-md bg-[#1A1A1A] text-[11px] font-mono text-[#A1A1AA] flex items-center gap-2">
            <BellSlash size={14} className="text-[#00E5FF]" />
            {remaining || t('muted')}
          </div>
        )}

        {!muted && (
          <div className="flex flex-col gap-1 mb-2">
            {MUTE_DURATIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`mute-duration-${opt.id}`}
                onClick={() => {
                  onClose?.();
                  onMute?.(opt.id);
                }}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
              >
                <BellSlash size={18} className="text-[#00E5FF]" />
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        )}

        {muted && (
          <button
            type="button"
            data-testid="mute-duration-unmute"
            onClick={() => {
              onClose?.();
              onUnmute?.();
            }}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
          >
            <Bell size={18} className="text-[#00E5FF]" />
            {t('unmute')}
          </button>
        )}
      </div>
    </div>
  );
}