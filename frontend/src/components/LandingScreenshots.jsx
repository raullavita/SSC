import React from 'react';
import { ChatsCircle, Phone, Gear, ShieldCheck, Clock } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';

function MockScreen({ title, subtitle, children, accent = '#00E5FF' }) {
  return (
    <div className="rounded-md tac-border bg-[#121212] overflow-hidden shadow-xl" data-testid="landing-screenshot-card">
      <div className="px-3 py-2 border-b border-[#27272A] flex items-center justify-between">
        <div>
          <div className="text-xs font-mono tracking-wider text-[#F0F0F0]">{title}</div>
          <div className="text-[10px] font-mono text-[#71717A]">{subtitle}</div>
        </div>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="p-4 min-h-[220px]">{children}</div>
    </div>
  );
}

export default function LandingScreenshots() {
  const { t } = useLocale();

  return (
    <section className="border-t border-[#27272A]/80" data-testid="landing-screenshots-section">
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
      <p className="text-xs font-medium uppercase tracking-widest text-[#71717A]">{t('landingScreenshotsLabel')}</p>
      <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">{t('landingScreenshotsTitle')}</h2>
      <p className="mt-3 text-base text-[#A1A1AA] max-w-2xl leading-relaxed">{t('landingScreenshotsBody')}</p>

      <div className="mt-10 grid md:grid-cols-3 gap-5">
        <MockScreen
          title={t('landingShotChatTitle')}
          subtitle={t('landingShotChatSub')}
          accent="#34C759"
        >
          <div className="space-y-2 text-sm">
            <div className="bg-[#232323] rounded-md px-3 py-2 max-w-[85%]">Hey — are we still on for tonight?</div>
            <div className="bg-[#1E2A38] rounded-md px-3 py-2 max-w-[85%] ml-auto">Yes. E2E only on this thread.</div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-[#71717A] mt-3">
              <ChatsCircle size={12} /> E2E · {t('landingShotEncrypted')}
            </div>
          </div>
        </MockScreen>

        <MockScreen
          title={t('landingShotCallsTitle')}
          subtitle={t('landingShotCallsSub')}
          accent="#FFD600"
        >
          <div className="flex flex-col items-center justify-center h-full py-4">
            <div className="w-16 h-16 rounded-md bg-[#232323] flex items-center justify-center mb-3">
              <Phone size={28} className="text-[#00E5FF]" />
            </div>
            <div className="font-mono text-sm">@alex_x</div>
            <div className="text-[10px] font-mono text-[#34C759] tracking-widest mt-1">VOICE · CONNECTED</div>
          </div>
        </MockScreen>

        <MockScreen
          title={t('landingShotSecurityTitle')}
          subtitle={t('landingShotSecuritySub')}
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <ShieldCheck size={16} className="text-[#00E5FF]" />
              <span>2FA · {t('off')}</span>
            </div>
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <Clock size={16} className="text-[#34C759]" />
              <span>{t('retentionBadge', { hours: '24' })}</span>
            </div>
            <div className="flex items-center gap-2 text-[#FF453A]">
              <Gear size={16} />
              <span>{t('landingShotPanic')}</span>
            </div>
          </div>
        </MockScreen>
      </div>
      </div>
    </section>
  );
}