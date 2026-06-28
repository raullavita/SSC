import React, { useCallback, useEffect, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { BUNDLED_STICKERS, stickerSvgMarkup } from '../lib/stickerPack';
import { gifSearchEnabled } from '../lib/gifSearchPrefs';
import { resolveTenorApiKey, searchTenorGifs } from '../lib/gifSearch';

export default function StickerGifPickerModal({
  open,
  onClose,
  onPickSticker,
  onPickGif,
  gifSearchOn = false,
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState('stickers');
  const [query, setQuery] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [tenorKey, setTenorKey] = useState('');
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setGifResults([]);
      setTab('stickers');
      setSendingId(null);
      return;
    }
    if (gifSearchOn) {
      resolveTenorApiKey().then(setTenorKey);
    }
  }, [open, gifSearchOn]);

  const runGifSearch = useCallback(async (q) => {
    if (!gifSearchOn || !tenorKey || q.trim().length < 2) {
      setGifResults([]);
      return;
    }
    setGifLoading(true);
    try {
      const rows = await searchTenorGifs(q, tenorKey);
      setGifResults(rows);
    } finally {
      setGifLoading(false);
    }
  }, [gifSearchOn, tenorKey]);

  useEffect(() => {
    if (!open || tab !== 'gifs') return undefined;
    const timer = setTimeout(() => runGifSearch(query), 300);
    return () => clearTimeout(timer);
  }, [open, tab, query, runGifSearch]);

  if (!open) return null;

  const handleSticker = async (sticker) => {
    if (sendingId) return;
    setSendingId(sticker.id);
    try {
      await onPickSticker?.(sticker);
      onClose?.();
    } finally {
      setSendingId(null);
    }
  };

  const handleGif = async (gif) => {
    if (sendingId) return;
    setSendingId(gif.id);
    try {
      await onPickGif?.(gif);
      onClose?.();
    } finally {
      setSendingId(null);
    }
  };

  const showGifTab = gifSearchOn;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-4 safe-bottom"
      onClick={onClose}
      data-testid="sticker-gif-picker-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="font-mono text-xs tracking-[0.25em]">{t('stickerGifPickerTitle')}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="close-sticker-gif-picker">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2 mb-3 shrink-0">
          <button
            type="button"
            onClick={() => setTab('stickers')}
            className={`flex-1 py-2 rounded-md text-xs font-mono tracking-wider ${tab === 'stickers' ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40' : 'bg-[#1A1A1A] tac-border'}`}
            data-testid="picker-tab-stickers"
          >
            {t('stickerTab')}
          </button>
          {showGifTab && (
            <button
              type="button"
              onClick={() => setTab('gifs')}
              className={`flex-1 py-2 rounded-md text-xs font-mono tracking-wider ${tab === 'gifs' ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40' : 'bg-[#1A1A1A] tac-border'}`}
              data-testid="picker-tab-gifs"
            >
              {t('gifTab')}
            </button>
          )}
        </div>
        <div className="overflow-y-auto min-h-0 flex-1">
          {tab === 'stickers' && (
            <div className="grid grid-cols-4 gap-2" data-testid="sticker-grid">
              {BUNDLED_STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  disabled={!!sendingId}
                  onClick={() => handleSticker(sticker)}
                  className="aspect-square rounded-md tac-border bg-[#1A1A1A] hover:bg-[#232323] p-1 flex items-center justify-center disabled:opacity-40"
                  data-testid={`sticker-${sticker.id}`}
                  title={sticker.label}
                >
                  <img
                    src={`data:image/svg+xml,${encodeURIComponent(stickerSvgMarkup(sticker))}`}
                    alt={sticker.label}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
          {tab === 'gifs' && showGifTab && (
            <>
              <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border mb-3">
                <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('gifSearchPlaceholder')}
                  data-testid="gif-search-input"
                  className="bg-transparent flex-1 outline-none border-0 text-sm"
                />
              </div>
              {!tenorKey && (
                <p className="text-[11px] font-mono text-[#A1A1AA] tracking-wider text-center py-4">
                  {t('gifSearchNoApiKey')}
                </p>
              )}
              {tenorKey && query.trim().length < 2 && (
                <p className="text-[11px] font-mono text-[#A1A1AA] tracking-wider text-center py-4">
                  {t('gifSearchHint')}
                </p>
              )}
              {gifLoading && (
                <p className="text-center text-[11px] font-mono text-[#A1A1AA] py-4">{t('gifSearchLoading')}</p>
              )}
              {!gifLoading && tenorKey && query.trim().length >= 2 && gifResults.length === 0 && (
                <p className="text-center text-[11px] font-mono text-[#A1A1AA] py-4">{t('gifSearchNoResults')}</p>
              )}
              <div className="grid grid-cols-3 gap-2" data-testid="gif-grid">
                {gifResults.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    disabled={!!sendingId}
                    onClick={() => handleGif(gif)}
                    className="aspect-square rounded-md overflow-hidden tac-border hover:brightness-110 disabled:opacity-40"
                    data-testid={`gif-option-${gif.id}`}
                  >
                    <img src={gif.previewUrl || gif.gifUrl} alt={gif.title || 'gif'} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}