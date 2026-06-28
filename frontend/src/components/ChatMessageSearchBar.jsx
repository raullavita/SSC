import React, { useEffect, useRef } from 'react';
import { MagnifyingGlass, X, CaretUp, CaretDown } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

export default function ChatMessageSearchBar({
  open,
  query,
  onQueryChange,
  onClose,
  matchIndex,
  matchCount,
  onPrev,
  onNext,
}) {
  const { t } = useLocale();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Enter' && e.shiftKey) onPrev?.();
      else if (e.key === 'Enter') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onPrev, onNext]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <div
      className="px-2 md:px-4 py-2 border-b border-[#27272A] shrink-0 flex items-center gap-2 bg-[#0A0A0A]"
      data-testid="chat-message-search-bar"
    >
      <MagnifyingGlass size={16} className="text-[#A1A1AA] shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange?.(e.target.value)}
        placeholder={t('searchMessages')}
        className="flex-1 min-w-0 text-sm px-2 py-1.5 bg-[#1A1A1A] border border-[#27272A] rounded-md outline-none focus:border-[#00E5FF]/50"
        data-testid="chat-message-search-input"
      />
      {hasQuery && (
        <span className="text-[10px] font-mono text-[#A1A1AA] whitespace-nowrap shrink-0" data-testid="chat-search-match-count">
          {matchCount === 0
            ? t('chatSearchNoResults')
            : t('chatSearchMatchCount', { current: matchIndex + 1, total: matchCount })}
        </span>
      )}
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasQuery || matchCount === 0}
        className="w-8 h-8 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center disabled:opacity-40"
        data-testid="chat-search-prev"
        aria-label={t('chatSearchPrev')}
      >
        <CaretUp size={14} />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasQuery || matchCount === 0}
        className="w-8 h-8 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center disabled:opacity-40"
        data-testid="chat-search-next"
        aria-label={t('chatSearchNext')}
      >
        <CaretDown size={14} />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-8 h-8 rounded-md tac-border bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center text-[#A1A1AA] hover:text-white"
        data-testid="chat-search-close"
        aria-label={t('chatSearchClose')}
      >
        <X size={14} />
      </button>
    </div>
  );
}