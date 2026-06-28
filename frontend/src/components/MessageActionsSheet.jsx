import React, { useEffect } from 'react';
import { ArrowBendUpLeft, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

export default function MessageActionsSheet({ open, message, onClose, onReply }) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !message) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center safe-bottom"
      onClick={onClose}
      data-testid="message-actions-sheet"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-t-md p-4 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.2em] truncate pr-2">{t('messageActionsTitle')}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <button
          type="button"
          data-testid="message-action-reply"
          onClick={() => { onClose?.(); onReply?.(message); }}
          className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
        >
          <ArrowBendUpLeft size={18} className="text-[#00E5FF]" />
          {t('messageActionReply')}
        </button>
      </div>
    </div>
  );
}