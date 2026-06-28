import React, { useEffect } from 'react';
import { ArrowBendUpLeft, ArrowBendUpRight, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { ALLOWED_REACTIONS } from '../lib/messageReactions';

export default function MessageActionsSheet({
  open, message, onClose, onReply, onForward, onEdit, onDelete, onReact,
  showForward = false, showEdit = false, showDelete = false, showReact = false,
}) {
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
        {showForward && (
          <button
            type="button"
            data-testid="message-action-forward"
            onClick={() => { onClose?.(); onForward?.(message); }}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
          >
            <ArrowBendUpRight size={18} className="text-[#00E5FF]" />
            {t('messageActionForward')}
          </button>
        )}
        {showEdit && (
          <button
            type="button"
            data-testid="message-action-edit"
            onClick={() => { onClose?.(); onEdit?.(message); }}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
          >
            <PencilSimple size={18} className="text-[#00E5FF]" />
            {t('messageActionEdit')}
          </button>
        )}
        {showDelete && (
          <button
            type="button"
            data-testid="message-action-delete"
            onClick={() => { onClose?.(); onDelete?.(message); }}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm text-[#FF3B30]"
          >
            <Trash size={18} />
            {t('messageActionDelete')}
          </button>
        )}
        {showReact && (
          <div
            className="mt-3 pt-3 border-t border-[#27272A] flex justify-between gap-1"
            data-testid="message-reaction-picker"
          >
            {ALLOWED_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                data-testid={`message-reaction-${emoji}`}
                onClick={() => { onClose?.(); onReact?.(message, emoji); }}
                className="flex-1 py-2 text-lg rounded-md hover:bg-[#1A1A1A] active:scale-95 transition"
                aria-label={t('messageReactionAdd', { emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}