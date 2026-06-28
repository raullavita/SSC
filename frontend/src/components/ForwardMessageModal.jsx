import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import Avatar from './Avatar';
import { conversationForwardLabel } from '../lib/messageForward';

export default function ForwardMessageModal({
  open,
  preview,
  targets,
  formatGroupLabel,
  onClose,
  onConfirm,
  busy = false,
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((c) => {
      const label = conversationForwardLabel(c, t, formatGroupLabel).toLowerCase();
      return label.includes(q);
    });
  }, [targets, query, t, formatGroupLabel]);

  if (!open) return null;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 safe-bottom"
      onClick={onClose}
      data-testid="forward-message-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="font-mono text-xs tracking-[0.2em]">{t('messageForwardTitle')}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white">
            <X size={16} />
          </button>
        </div>

        {preview?.preview && (
          <div className="mb-3 px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#27272A] text-xs text-[#A1A1AA] truncate shrink-0">
            {preview.preview}
          </div>
        )}

        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border mb-3 shrink-0">
          <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('messageForwardSearch')}
            className="bg-transparent flex-1 outline-none border-0 text-sm"
            data-testid="forward-search-input"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {filtered.length === 0 && (
            <div className="text-center text-xs text-[#A1A1AA] py-6">{t('messageForwardNoTargets')}</div>
          )}
          {filtered.map((c) => {
            const id = c.conversation_id;
            const checked = selected.has(id);
            const label = conversationForwardLabel(c, t, formatGroupLabel);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-left hover:bg-[#1A1A1A] ${checked ? 'bg-[#1A1A1A]' : ''}`}
                data-testid={`forward-target-${id}`}
              >
                <input type="checkbox" readOnly checked={checked} className="accent-[#00E5FF]" />
                <Avatar user={c.is_group ? null : c.peer} isGroup={c.is_group} size="sm" />
                <span className="text-sm truncate">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={selected.size === 0 || busy}
          onClick={() => onConfirm?.([...selected])}
          className="mt-4 w-full py-2.5 text-sm font-medium rounded-md bg-[#00E5FF] text-black hover:brightness-110 disabled:opacity-40 shrink-0"
          data-testid="forward-confirm"
        >
          {busy ? t('processing') : t('messageForwardSend', { count: selected.size })}
        </button>
      </div>
    </div>
  );
}