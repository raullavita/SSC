import React, { useEffect, useMemo, useState } from 'react';
import { Images, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { useDecryptedAttachment } from '../lib/attachmentDecrypt';
import { filenameFromCaption } from '../lib/attachmentUtils';
import ImagePreviewModal from './ImagePreviewModal';

function GalleryThumbnail({ item, caption, privateKey, myUserId, peerUserId, onOpen }) {
  const { objectUrl, error, loading } = useDecryptedAttachment(
    item.msg,
    item.attachment_id,
    privateKey,
    myUserId,
    peerUserId,
  );

  if (loading) {
    return (
      <div
        className="aspect-square rounded-md bg-[#1A1A1A] tac-border animate-pulse"
        data-testid={`gallery-thumb-loading-${item.message_id}`}
      />
    );
  }
  if (error || !objectUrl) {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="aspect-square rounded-md bg-[#1A1A1A] tac-border flex items-center justify-center text-[10px] font-mono text-[#A1A1AA] p-2"
        data-testid={`gallery-thumb-error-${item.message_id}`}
      >
        ?
      </button>
    );
  }

  const alt = filenameFromCaption(caption, 'image');

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className="aspect-square rounded-md overflow-hidden tac-border hover:brightness-110 transition"
      data-testid={`gallery-thumb-${item.message_id}`}
    >
      <img src={objectUrl} alt={alt} className="w-full h-full object-cover" />
    </button>
  );
}

function GalleryPreview({
  items,
  index,
  captions,
  privateKey,
  myUserId,
  peerUserId,
  onClose,
  onPrev,
  onNext,
}) {
  const item = items[index];
  const { objectUrl, error, loading } = useDecryptedAttachment(
    item?.msg,
    item?.attachment_id,
    privateKey,
    myUserId,
    peerUserId,
  );

  if (!item) return null;
  if (loading) return null;
  if (error || !objectUrl) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center text-[#A1A1AA] font-mono text-sm">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2"><X size={18} /></button>
        unable to decrypt
      </div>
    );
  }

  const alt = filenameFromCaption(captions[item.message_id], 'image');

  return (
    <ImagePreviewModal
      src={objectUrl}
      alt={alt}
      onClose={onClose}
      onPrev={index > 0 ? onPrev : null}
      onNext={index < items.length - 1 ? onNext : null}
      positionLabel={`${index + 1} / ${items.length}`}
    />
  );
}

export default function ChatMediaGalleryModal({
  open,
  onClose,
  items,
  captions = {},
  privateKey,
  myUserId,
  peerUserId,
  onJumpToMessage,
}) {
  const { t } = useLocale();
  const [previewIndex, setPreviewIndex] = useState(null);
  const mediaItems = useMemo(() => items || [], [items]);

  useEffect(() => {
    if (!open) setPreviewIndex(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (previewIndex != null) setPreviewIndex(null);
        else onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, previewIndex]);

  if (!open) return null;

  const openPreview = (item) => {
    const idx = mediaItems.findIndex((m) => m.message_id === item.message_id);
    setPreviewIndex(idx >= 0 ? idx : 0);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xl flex items-start justify-center pt-16 px-4 safe-top safe-bottom"
        onClick={onClose}
        data-testid="chat-media-gallery-modal"
      >
        <div
          className="w-full max-w-lg bg-[#121212] tac-border rounded-md p-4 fade-up max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Images size={16} className="text-[#00E5FF]" />
              <h3 className="font-mono text-xs tracking-[0.25em]">{t('mediaGalleryTitle')}</h3>
              <span className="text-[10px] font-mono text-[#A1A1AA]">{mediaItems.length}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#A1A1AA] hover:text-white"
              data-testid="close-media-gallery"
            >
              <X size={16} />
            </button>
          </div>
          {mediaItems.length === 0 ? (
            <div className="py-8 text-center text-[11px] font-mono text-[#A1A1AA] tracking-wider">
              {t('mediaGalleryEmpty')}
            </div>
          ) : (
            <div className="overflow-y-auto">
              <div className="grid grid-cols-3 gap-2" data-testid="media-gallery-grid">
                {mediaItems.map((item) => (
                  <GalleryThumbnail
                    key={item.message_id}
                    item={item}
                    caption={captions[item.message_id]}
                    privateKey={privateKey}
                    myUserId={myUserId}
                    peerUserId={peerUserId}
                    onOpen={openPreview}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {previewIndex != null && (
        <GalleryPreview
          items={mediaItems}
          index={previewIndex}
          captions={captions}
          privateKey={privateKey}
          myUserId={myUserId}
          peerUserId={peerUserId}
          onClose={() => setPreviewIndex(null)}
          onPrev={() => setPreviewIndex((i) => Math.max(0, i - 1))}
          onNext={() => setPreviewIndex((i) => Math.min(mediaItems.length - 1, i + 1))}
        />
      )}
      {previewIndex != null && onJumpToMessage && (
        <button
          type="button"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-md bg-[#00E5FF] text-black text-xs font-mono tracking-wider"
          onClick={() => {
            onJumpToMessage(mediaItems[previewIndex]?.message_id);
            setPreviewIndex(null);
            onClose?.();
          }}
          data-testid="gallery-jump-to-message"
        >
          {t('mediaGalleryJumpToMessage')}
        </button>
      )}
    </>
  );
}