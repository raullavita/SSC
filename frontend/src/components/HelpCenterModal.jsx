import React, { useEffect, useMemo, useState } from 'react';
import { X, Lifebuoy, CaretLeft, BookOpenText } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { getFaqArticles } from '../lib/help/faqContent';
import HelpMarkdownContent from './HelpMarkdownContent';

export default function HelpCenterModal({ open, onClose }) {
  const { t, locale } = useLocale();
  const articles = useMemo(() => getFaqArticles(locale), [locale]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!open) setActiveId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (activeId) setActiveId(null);
        else onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeId, onClose]);

  if (!open) return null;

  const active = articles.find((a) => a.id === activeId);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xl flex items-start justify-center pt-10 px-4 pb-8"
      onClick={onClose}
      data-testid="help-center-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md fade-up max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {active ? (
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="text-[#A1A1AA] hover:text-white shrink-0"
                data-testid="help-center-back"
                aria-label={t('back')}
              >
                <CaretLeft size={18} weight="bold" />
              </button>
            ) : (
              <Lifebuoy size={18} className="text-[#00E5FF] shrink-0" />
            )}
            <h3 className="font-mono text-xs tracking-[0.25em] truncate">
              {active ? active.title : t('helpCenterTitle')}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="help-center-close">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 flex-1">
          {!active ? (
            <>
              <p className="text-xs text-[#71717A] mb-4">{t('helpCenterHint')}</p>
              <ul className="space-y-2">
                {articles.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(article.id)}
                      className="w-full text-left px-3 py-3 rounded-md bg-[#1A1A1A] tac-border hover:bg-[#232323] flex items-center gap-3 transition"
                      data-testid={`help-topic-${article.id}`}
                    >
                      <BookOpenText size={18} className="text-[#00E5FF] shrink-0" />
                      <span className="text-sm text-[#F0F0F0]">{article.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <article data-testid={`help-article-${active.id}`}>
              <HelpMarkdownContent text={active.body} />
            </article>
          )}
        </div>
      </div>
    </div>
  );
}