import React, { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { EDIT_WINDOW_MINUTES } from '../lib/messageEdit';

export default function EditMessageModal({
  open,
  draft,
  onDraftChange,
  onSave,
  onClose,
  saving = false,
}) {
  const { t } = useLocale();
  const [localDraft, setLocalDraft] = useState(draft || '');

  useEffect(() => {
    if (open) setLocalDraft(draft || '');
  }, [open, draft]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = localDraft.trim();
  const unchanged = trimmed === (draft || '').trim();

  const handleSave = () => {
    if (!trimmed || unchanged || saving) return;
    onDraftChange?.(localDraft);
    onSave?.(localDraft.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 safe-bottom"
      onClick={onClose}
      data-testid="edit-message-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.2em]">{t('messageEditTitle')}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-[#A1A1AA] mb-3">
          {t('messageEditHint', { minutes: EDIT_WINDOW_MINUTES })}
        </p>
        <textarea
          value={localDraft}
          onChange={(e) => setLocalDraft(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-md bg-[#1A1A1A] border border-[#27272A] resize-none"
          data-testid="edit-message-input"
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-[#27272A] rounded-md hover:bg-[#1A1A1A]"
            data-testid="edit-message-cancel"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!trimmed || unchanged || saving}
            className="flex-1 py-2.5 text-sm font-medium rounded-md bg-[#00E5FF] text-black hover:brightness-110 disabled:opacity-40"
            data-testid="edit-message-save"
          >
            {saving ? t('processing') : t('messageEditSave')}
          </button>
        </div>
      </div>
    </div>
  );
}