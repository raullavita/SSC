import React from 'react';
import { ShieldWarning, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

export default function KeyChangeWarningBanner({
  peerUsername,
  onReview,
  onDismiss,
}) {
  const { t } = useLocale();

  return (
    <div
      className="mx-3 md:mx-6 mb-2 rounded-md border border-[#FF9F0A]/60 bg-[#2A1F0A] px-3 py-3 shadow-[0_0_0_1px_rgba(255,159,10,0.15)]"
      data-testid="key-change-warning-banner"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <ShieldWarning size={18} className="text-[#FF9F0A] shrink-0 mt-0.5" weight="duotone" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono tracking-wider text-[#FF9F0A] mb-1">
            {t('keyChangeWarningTitle')}
          </div>
          <p className="text-xs text-[#F0F0F0] leading-relaxed">
            {t('keyChangeWarningBody', { user: peerUsername ? `@${peerUsername}` : t('keyChangeWarningContact') })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReview}
              className="px-3 py-1.5 text-xs font-mono tracking-wider rounded-md bg-[#FF9F0A] text-black hover:brightness-110"
              data-testid="key-change-review-button"
            >
              {t('keyChangeWarningReview')}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs font-mono tracking-wider rounded-md border border-[#52525B] text-[#D4D4D8] hover:bg-[#1A1A1A]"
              data-testid="key-change-dismiss-button"
            >
              {t('keyChangeWarningDismiss')}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[#A1A1AA] hover:text-white shrink-0"
          aria-label={t('keyChangeWarningDismiss')}
          data-testid="key-change-close-button"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}