import React, { useEffect, useState } from 'react';
import { ChartBar, Plus, Trash, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { MAX_POLL_OPTIONS, MIN_POLL_OPTIONS } from '../lib/pollMessage';

const DEFAULT_OPTIONS = ['', ''];

export default function CreatePollModal({ open, onClose, onCreate, busy = false }) {
  const { t } = useLocale();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);

  useEffect(() => {
    if (!open) {
      setQuestion('');
      setOptions(DEFAULT_OPTIONS);
    }
  }, [open]);

  if (!open) return null;

  const updateOption = (index, value) => {
    setOptions((cur) => cur.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    if (options.length >= MAX_POLL_OPTIONS) return;
    setOptions((cur) => [...cur, '']);
  };

  const removeOption = (index) => {
    if (options.length <= MIN_POLL_OPTIONS) return;
    setOptions((cur) => cur.filter((_, i) => i !== index));
  };

  const submit = () => {
    onCreate?.({ question, options });
  };

  const canSubmit = question.trim().length > 0
    && options.filter((o) => o.trim()).length >= MIN_POLL_OPTIONS;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-4 safe-bottom"
      onClick={onClose}
      data-testid="create-poll-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ChartBar size={16} className="text-[#00E5FF]" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('createPollTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="close-create-poll">
            <X size={16} />
          </button>
        </div>

        <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
          {t('pollQuestionLabel')}
        </label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('pollQuestionPlaceholder')}
          data-testid="poll-question-input"
          className="w-full h-10 px-3 mb-3 text-sm rounded-md bg-[#1A1A1A] tac-border"
        />

        <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
          {t('pollOptionsLabel')}
        </label>
        <div className="space-y-2 mb-3">
          {options.map((opt, index) => (
            <div key={`poll-opt-${index}`} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={t('pollOptionPlaceholder', { n: String(index + 1) })}
                data-testid={`poll-option-input-${index}`}
                className="flex-1 h-10 px-3 text-sm rounded-md bg-[#1A1A1A] tac-border"
              />
              {options.length > MIN_POLL_OPTIONS && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="w-10 h-10 rounded-md tac-border bg-[#1A1A1A] flex items-center justify-center text-[#A1A1AA] hover:text-white"
                  data-testid={`poll-option-remove-${index}`}
                  aria-label={t('pollRemoveOption')}
                >
                  <Trash size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < MAX_POLL_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-2 text-xs font-mono text-[#00E5FF] hover:underline mb-4"
            data-testid="poll-add-option"
          >
            <Plus size={14} />
            {t('pollAddOption')}
          </button>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || busy}
          data-testid="poll-create-submit"
          className="w-full h-11 rounded-md bg-[#00E5FF] text-black font-medium text-sm disabled:opacity-40"
        >
          {busy ? t('pollCreating') : t('pollCreateSubmit')}
        </button>
      </div>
    </div>
  );
}