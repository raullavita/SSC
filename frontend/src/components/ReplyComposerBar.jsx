import React from 'react';
import { X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

export default function ReplyComposerBar({ quote, onCancel }) {
  const { t } = useLocale();
  if (!quote) return null;

  return (
    <div
      className="border-t border-[#27272A] px-3 py-2 bg-[#101010] flex items-start gap-2"
      data-testid="reply-composer-bar"
    >
      <div className="w-1 self-stretch rounded-full bg-[#00E5FF] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono text-[#00E5FF] tracking-wider truncate">
          {t('replyingTo', { user: quote.author ? `@${quote.author}` : '…' })}
        </div>
        <div className="text-xs text-[#A1A1AA] truncate mt-0.5">{quote.preview}</div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-[#A1A1AA] hover:text-white shrink-0 p-1"
        data-testid="reply-composer-cancel"
        aria-label={t('replyCancel')}
      >
        <X size={16} />
      </button>
    </div>
  );
}