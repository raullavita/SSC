import React from 'react';
import { getPublicAppVersion, PUBLIC_SITE_UPDATES } from '../lib/siteStage';

function SectionHeading({ label, title, body }) {
  return (
    <div className="max-w-2xl">
      {label ? (
        <p className="text-xs font-medium uppercase tracking-widest text-[#71717A]">{label}</p>
      ) : null}
      <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-white">{title}</h2>
      {body ? (
        <p className="mt-3 text-base text-[#A1A1AA] leading-relaxed">{body}</p>
      ) : null}
    </div>
  );
}

/** Public changelog — shown on marketing site (construction + full landing). */
export default function SiteUpdatesSection({ t, showStageCard = true, dataTestId = 'site-updates-section' }) {
  const appVersion = getPublicAppVersion();

  return (
    <section
      id="updates"
      className="border-t border-[#27272A]/80 bg-[#0D0D0D]/60 scroll-mt-24"
      data-testid={dataTestId}
    >
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <SectionHeading
          label={t('publicSiteUpdatesLabel')}
          title={t('publicSiteUpdatesTitle')}
          body={t('publicSiteUpdatesBody')}
        />

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {showStageCard ? (
            <article className="md:col-span-1 rounded-xl border border-[#27272A] bg-[#121212] p-5">
              <p className="text-xs uppercase tracking-widest text-[#71717A]">{t('publicSiteStageLabel')}</p>
              <p className="mt-3 text-lg font-semibold text-[#FFD600]">{t('publicSiteStagePrivateDev')}</p>
              <p className="mt-2 text-sm text-[#A1A1AA]">{t('publicSiteStageVersion', { version: appVersion })}</p>
            </article>
          ) : null}
          <div className={showStageCard ? 'md:col-span-2 space-y-4' : 'md:col-span-3 space-y-4'}>
            {PUBLIC_SITE_UPDATES.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-[#27272A] bg-[#121212] px-5 py-4"
                data-testid={`site-update-${entry.id}`}
              >
                <time className="text-xs text-[#71717A]">{entry.date}</time>
                <h3 className="mt-1 text-base font-semibold text-white">{t(entry.titleKey)}</h3>
                <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">{t(entry.bodyKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}