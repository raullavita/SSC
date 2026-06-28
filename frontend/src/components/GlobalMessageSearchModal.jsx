import React, { useEffect } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import Avatar from './Avatar';
import { splitTextForHighlight } from '../lib/chatSearch';
import { MIN_GLOBAL_SEARCH_LENGTH, conversationSearchTitle } from '../lib/globalMessageSearch';

function HighlightedSnippet({ text, query }) {
  const parts = splitTextForHighlight(text, query);
  return (
    <>
      {parts.map((part, i) => (
        part.match
          ? <mark key={i} className="bg-[#FFD600]/35 text-inherit rounded-sm px-0.5">{part.text}</mark>
          : <span key={i}>{part.text}</span>
      ))}
    </>
  );
}

export default function GlobalMessageSearchModal({
  open,
  query,
  onQueryChange,
  onClose,
  results,
  loading,
  onSelect,
  formatGroupLabel,
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasQuery = query.trim().length >= MIN_GLOBAL_SEARCH_LENGTH;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xl flex items-start justify-center pt-20 px-4 safe-top"
      onClick={onClose}
      data-testid="global-message-search-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.25em]">{t('globalSearchTitle')}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="close-global-search">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-[#A1A1AA] mb-3 normal-case tracking-normal">
          {t('globalSearchHint')}
        </p>
        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border">
          <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
          <input
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            placeholder={t('searchMessages')}
            data-testid="global-search-input"
            className="bg-transparent flex-1 outline-none border-0 text-sm"
            autoFocus
          />
        </div>
        <div className="mt-3 max-h-80 overflow-y-auto">
          {!hasQuery && (
            <div className="px-3 py-4 text-center text-[11px] font-mono text-[#A1A1AA] tracking-wider">
              {t('type2chars')}
            </div>
          )}
          {hasQuery && loading && (
            <div className="px-3 py-6 text-center text-[11px] font-mono text-[#A1A1AA] tracking-wider" data-testid="global-search-loading">
              {t('globalSearchLoading')}
            </div>
          )}
          {hasQuery && !loading && results.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px] font-mono text-[#A1A1AA] tracking-wider" data-testid="global-search-no-results">
              {t('globalSearchNoResults')}
            </div>
          )}
          {hasQuery && !loading && results.map((hit) => {
            const conv = hit.conversation;
            const title = conversationSearchTitle(conv, formatGroupLabel, t);
            return (
              <button
                key={`${hit.conversation_id}-${hit.message_id}`}
                type="button"
                onClick={() => onSelect?.(hit)}
                data-testid={`global-search-result-${hit.message_id}`}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-start gap-3"
              >
                <Avatar user={conv.is_group ? null : conv.peer} isGroup={conv.is_group} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{title}</span>
                    <span className="text-[10px] font-mono text-[#A1A1AA] shrink-0">
                      {hit.created_at
                        ? new Date(hit.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                        : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                    <HighlightedSnippet text={hit.snippet} query={query} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}