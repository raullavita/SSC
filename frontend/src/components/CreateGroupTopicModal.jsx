import React, { useEffect, useState } from 'react';
import { Hash, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

const MAX_TOPIC_NAME = 64;

export default function CreateGroupTopicModal({ open, onClose, onCreate, busy = false }) {
  const { t } = useLocale();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-4 safe-bottom"
      onClick={onClose}
      data-testid="create-group-topic-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-[#00E5FF]" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('groupTopicCreateTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="close-create-group-topic">
            <X size={16} />
          </button>
        </div>

        <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
          {t('groupTopicNameLabel')}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupTopicNamePlaceholder')}
          maxLength={MAX_TOPIC_NAME}
          data-testid="group-topic-name-input"
          className="w-full h-10 px-3 mb-4 text-sm rounded-md bg-[#1A1A1A] tac-border"
        />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onCreate?.(name.trim())}
          className="w-full py-2.5 text-sm font-medium rounded-md bg-[#00E5FF] text-black hover:brightness-110 disabled:opacity-40"
          data-testid="group-topic-create-submit"
        >
          {busy ? t('processing') : t('groupTopicCreate')}
        </button>
      </div>
    </div>
  );
}