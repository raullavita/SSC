import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, DownloadSimple, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

/**
 * Full-screen image preview with pinch/wheel zoom and save.
 */
export default function ImagePreviewModal({
  src, alt, onClose, onPrev, onNext, positionLabel,
}) {
  const { t } = useLocale();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const clampScale = (s) => Math.min(5, Math.max(1, s));

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => clampScale(s + delta));
  };

  const onPointerDown = (e) => {
    if (scale <= 1) return;
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setOffset({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  };

  const onPointerUp = () => { dragRef.current = null; };

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { dist, scale };
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    const [a, b] = e.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const ratio = dist / pinchRef.current.dist;
    setScale(clampScale(pinchRef.current.scale * ratio));
  };

  const onTouchEnd = () => { pinchRef.current = null; };

  const onSave = useCallback(() => {
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'image';
    a.click();
  }, [src, alt]);

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col safe-top safe-bottom relative"
      onClick={onBackdropClick}
      data-testid="image-preview-modal"
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-2 text-sm font-mono text-[#A1A1AA] hover:text-white"
          data-testid="image-preview-save"
        >
          <DownloadSimple size={18} />
          {t('saveImage')}
        </button>
        {positionLabel && (
          <span className="text-[11px] font-mono text-[#A1A1AA] tracking-wider" data-testid="image-preview-position">
            {positionLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-md tac-border bg-[#121212] flex items-center justify-center hover:bg-[#1A1A1A]"
          data-testid="image-preview-close"
        >
          <X size={18} />
        </button>
      </div>
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-md tac-border bg-[#121212]/90 flex items-center justify-center hover:bg-[#1A1A1A]"
          data-testid="image-preview-prev"
        >
          <CaretLeft size={20} />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-md tac-border bg-[#121212]/90 flex items-center justify-center hover:bg-[#1A1A1A]"
          data-testid="image-preview-next"
        >
          <CaretRight size={20} />
        </button>
      )}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center touch-none relative"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={src}
          alt={alt || 'preview'}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-75"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          data-testid="image-preview-img"
        />
      </div>
    </div>
  );
}