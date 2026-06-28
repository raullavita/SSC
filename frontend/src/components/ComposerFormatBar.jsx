import React from 'react';
import { TextB, TextItalic, ListBullets, ListNumbers } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

export default function ComposerFormatBar({ onBold, onItalic, onBulletList, onNumberedList, disabled = false }) {
  const { t } = useLocale();
  const btnClass = 'w-9 h-9 rounded-md tac-border bg-[#121212] active:bg-[#1A1A1A] flex items-center justify-center shrink-0 disabled:opacity-40';

  return (
    <div
      className="border-t border-[#27272A] px-2 py-1.5 flex items-center gap-1 bg-[#101010]"
      data-testid="composer-format-bar"
    >
      <button
        type="button"
        onClick={onBold}
        disabled={disabled}
        className={btnClass}
        title={t('formatBold')}
        data-testid="format-bold"
      >
        <TextB size={16} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onItalic}
        disabled={disabled}
        className={btnClass}
        title={t('formatItalic')}
        data-testid="format-italic"
      >
        <TextItalic size={16} />
      </button>
      <button
        type="button"
        onClick={onBulletList}
        disabled={disabled}
        className={btnClass}
        title={t('formatBulletList')}
        data-testid="format-bullet-list"
      >
        <ListBullets size={16} />
      </button>
      <button
        type="button"
        onClick={onNumberedList}
        disabled={disabled}
        className={btnClass}
        title={t('formatNumberedList')}
        data-testid="format-numbered-list"
      >
        <ListNumbers size={16} />
      </button>
    </div>
  );
}