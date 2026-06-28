import React, { useEffect, useState } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { fetchLinkPreviewClient } from '../lib/linkPreviewFetch';

export default function LinkPreviewCard({ url }) {
  const { t } = useLocale();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchLinkPreviewClient(url).then((data) => {
      if (!cancelled) {
        setPreview(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!url) return null;

  if (loading) {
    return (
      <div
        className="mt-2 p-2 rounded-md bg-[#1A1A1A] tac-border text-[10px] font-mono text-[#A1A1AA]"
        data-testid="link-preview-loading"
      >
        {t('linkPreviewLoading')}
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-md overflow-hidden bg-[#1A1A1A] tac-border hover:bg-[#232323] transition"
      data-testid="link-preview-card"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full max-h-36 object-cover"
          data-testid="link-preview-image"
        />
      )}
      <div className="p-2.5">
        <div className="text-[10px] font-mono text-[#00E5FF] tracking-wider truncate flex items-center gap-1">
          <ArrowSquareOut size={12} className="shrink-0" />
          <span className="truncate">{preview.siteName || preview.title}</span>
        </div>
        {preview.title && preview.title !== preview.siteName && (
          <div className="text-sm font-medium mt-1 line-clamp-2">{preview.title}</div>
        )}
        {preview.description && (
          <div className="text-[11px] text-[#A1A1AA] mt-1 line-clamp-2">{preview.description}</div>
        )}
      </div>
    </a>
  );
}