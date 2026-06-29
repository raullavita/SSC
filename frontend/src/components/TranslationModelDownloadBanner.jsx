import React from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

export default function TranslationModelDownloadBanner({ status }) {
  const { t } = useLocale();
  if (!status || status.state === 'idle' || status.state === 'unsupported') return null;

  const percent = status.percent != null ? Math.round(status.percent) : null;
  const label = status.state === 'error'
    ? t('translateModelDownloadError')
    : status.state === 'ready'
      ? t('translateModelDownloadReady')
      : t('translateModelDownloading');

  return (
    <div
      className="mx-3 md:mx-6 mb-2 rounded-md border border-[#27272A] bg-[#141414] px-3 py-2"
      data-testid="translate-model-download-banner"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider text-[#A1A1AA]">
        <DownloadSimple size={14} className="text-[#00E5FF] shrink-0" />
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {percent != null && status.state !== 'error' && (
          <span data-testid="translate-model-download-percent">{percent}%</span>
        )}
      </div>
      {status.state === 'downloading' && (
        <div className="mt-2 h-1.5 rounded-full bg-[#1A1A1A] overflow-hidden" data-testid="translate-model-download-bar">
          <div
            className="h-full rounded-full bg-[#00E5FF] transition-all duration-300 ease-out"
            style={{ width: `${Math.max(4, percent ?? 8)}%` }}
          />
        </div>
      )}
    </div>
  );
}