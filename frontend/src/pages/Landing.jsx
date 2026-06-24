import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, Translate, Lightning, LockKey, Eye, DeviceMobile, Desktop } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import LanguagePicker from '../components/LanguagePicker';
import { isInstalledClient } from '../lib/platform';

export default function Landing() {
  const { t } = useLocale();
  const installed = isInstalledClient();

  const features = [
    { icon: ShieldCheck, titleKey: 'landingFeatureE2eTitle', bodyKey: 'landingFeatureE2eBody' },
    { icon: Clock, titleKey: 'landingFeature24hTitle', bodyKey: 'landingFeature24hBody' },
    { icon: Translate, titleKey: 'landingFeatureTranslateTitle', bodyKey: 'landingFeatureTranslateBody' },
    { icon: Lightning, titleKey: 'landingFeaturePanicTitle', bodyKey: 'landingFeaturePanicBody' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#00E5FF] opacity-[0.08] blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-[#FFD600] opacity-[0.06] blur-3xl pointer-events-none" />

      <header className="relative z-10 glass-header sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="ssc-logo">
            <div className="w-8 h-8 rounded-md bg-[#00E5FF] flex items-center justify-center">
              <LockKey size={18} weight="bold" className="text-black" />
            </div>
            <span className="font-mono text-sm tracking-[0.25em]">SSC</span>
          </div>
          <nav className="flex items-center gap-3">
            <LanguagePicker className="w-32 hidden sm:flex" />
            {installed ? (
              <>
                <Link to="/login" data-testid="landing-login-link" className="px-4 py-2 text-sm text-[#A1A1AA] hover:text-white transition">{t('landingLogin')}</Link>
                <Link to="/register" data-testid="landing-register-link" className="px-4 py-2 text-sm bg-[#00E5FF] text-black font-medium rounded-md hover:brightness-110 transition">{t('landingRegister')}</Link>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#27272A] bg-[#121212] text-xs font-mono tracking-widest uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] pulse-glow" />
              {t('landingBadge')}
            </div>
            <h1 className="font-mono text-5xl md:text-6xl font-bold tracking-tighter leading-[1.05]">
              {t('landingTitle1')}<br />
              <span className="text-[#00E5FF]">{t('landingTitle2')}</span>
            </h1>
            <p className="mt-6 text-[#A1A1AA] text-lg max-w-xl leading-relaxed">
              {installed ? t('landingSubtitle') : t('landingDownloadSubtitle')}
            </p>

            {installed ? (
              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/register" data-testid="cta-create-account" className="px-6 py-3 bg-[#00E5FF] text-black font-medium rounded-md hover:brightness-110 transition">
                  {t('landingCtaCreate')}
                </Link>
                <Link to="/login" data-testid="cta-login" className="px-6 py-3 border border-[#27272A] bg-[#121212] hover:bg-[#1A1A1A] rounded-md transition">
                  {t('landingCtaLogin')}
                </Link>
              </div>
            ) : (
              <div className="mt-10 space-y-3 max-w-lg" data-testid="landing-download-panel">
                <p className="text-sm text-[#A1A1AA]">{t('landingDownloadBody')}</p>
                <div className="p-4 rounded-md tac-border bg-[#121212] flex items-start gap-3">
                  <DeviceMobile size={22} className="text-[#00E5FF] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{t('landingGetAndroid')}</div>
                    <p className="text-xs text-[#A1A1AA] mt-1">{t('landingGetAndroidHint')}</p>
                  </div>
                </div>
                <div className="p-4 rounded-md tac-border bg-[#121212] flex items-start gap-3">
                  <Desktop size={22} className="text-[#00E5FF] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{t('landingGetWindows')}</div>
                    <p className="text-xs text-[#A1A1AA] mt-1">{t('landingGetWindowsHint')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center gap-6 text-xs font-mono text-[#A1A1AA] uppercase tracking-[0.2em] flex-wrap">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> {installed ? 'libsignal' : 'Signal-grade'}</span>
              <span className="flex items-center gap-1.5"><LockKey size={14} /> E2E</span>
              <span className="flex items-center gap-1.5"><Eye size={14} /> Zero-knowledge</span>
            </div>
          </div>

          <div className="md:col-span-5 fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="rounded-md tac-border bg-[#121212] p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#27272A]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-[#232323] flex items-center justify-center text-xs font-mono">AX</div>
                  <div>
                    <div className="text-sm">@alex_x</div>
                    <div className="text-[10px] font-mono text-[#34C759] tracking-widest">E2E · ONLINE</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#FFD600] tracking-widest">23:54:11</div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex">
                  <div className="bg-[#232323] rounded-md px-3 py-2 max-w-[80%]">
                    Salut! Cum a fost ziua?
                    <div className="text-[10px] font-mono text-[#A1A1AA] mt-1">RO → EN: &quot;Hi! How was your day?&quot;</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#1E2A38] rounded-md px-3 py-2 max-w-[80%]">
                    Pretty good — auto-translated though?
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-[#232323] rounded-md px-3 py-2 max-w-[80%]">
                    Da, mereu :)
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-[#A1A1AA] tracking-widest uppercase">
                <Clock size={12} /> AUTO-DELETE IN 23:54:11
              </div>
            </div>
          </div>
        </div>

        <div className="mt-32 grid md:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={f.titleKey} className="rounded-md tac-border bg-[#121212] p-5 hover:bg-[#1A1A1A] transition fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
              <f.icon size={22} className="text-[#00E5FF]" weight="duotone" />
              <h3 className="mt-4 font-mono text-sm tracking-wider uppercase">{t(f.titleKey)}</h3>
              <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">{t(f.bodyKey)}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#27272A] px-6 py-6 text-xs font-mono text-[#A1A1AA] tracking-widest flex justify-between max-w-6xl mx-auto">
        <span>© SSC · NO_PHONE_REQUIRED</span>
        <span>v0.1 · DEFCON_READY</span>
      </footer>
    </div>
  );
}