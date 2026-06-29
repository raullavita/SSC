import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  Translate,
  Lightning,
  LockKey,
  Eye,
  DeviceMobile,
  Desktop,
  DownloadSimple,
  UsersThree,
  EnvelopeSimple,
  ArrowDown,
  HardHat,
  TrafficCone,
  Newspaper,
} from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import LanguagePicker from '../components/LanguagePicker';
import LandingScreenshots from '../components/LandingScreenshots';
import MarketingPage from '../components/MarketingPage';
import { isInstalledClient } from '../lib/platform';
import { isSitePublicConstructionMode } from '../lib/siteGate';
import { getPublicAppVersion, PUBLIC_SITE_UPDATES } from '../lib/siteStage';

const APP_VERSION = getPublicAppVersion();
const DOWNLOAD_APK_URL = process.env.REACT_APP_DOWNLOAD_APK_URL || '';
const DOWNLOAD_WIN_URL = process.env.REACT_APP_DOWNLOAD_WIN_URL || '';
const DOWNLOAD_ANDROID_BETA_URL = process.env.REACT_APP_DOWNLOAD_ANDROID_BETA_URL || '';
const DOWNLOAD_PLAY_STORE_URL = process.env.REACT_APP_GOOGLE_PLAY_STORE_URL || '';
const CONTACT_EMAIL = 'contact@supersecurechat.com';
const SITE_ORIGIN = 'https://www.supersecurechat.com';

function ActionLink({ href, label, testId, variant = 'primary', external, icon: Icon }) {
  if (!href) return null;
  const cls = variant === 'secondary' ? 'btn-secondary w-full sm:w-auto' : 'btn-primary w-full sm:w-auto';
  const content = (
    <>
      {Icon ? <Icon size={18} weight="bold" /> : null}
      {label}
    </>
  );
  if (external) {
    return (
      <a href={href} className={cls} data-testid={testId} rel="noopener noreferrer" target="_blank">
        {content}
      </a>
    );
  }
  return (
    <a href={href} className={cls} data-testid={testId}>
      {content}
    </a>
  );
}

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

function NavAnchor({ href, children }) {
  return (
    <a href={href} className="btn-ghost hidden md:inline-flex">
      {children}
    </a>
  );
}

function SiteHeader({ t, installed, publicConstruction }) {
  return (
    <header className="relative z-20 glass-header sticky top-0">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-3 shrink-0" data-testid="ssc-logo">
          <div className="w-9 h-9 rounded-lg bg-[#00E5FF] flex items-center justify-center">
            <LockKey size={20} weight="bold" className="text-black" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide">Super Secure Chat</span>
            <div className="text-[11px] text-[#71717A] hidden sm:block">supersecurechat.com</div>
          </div>
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          {publicConstruction ? (
            <NavAnchor href="#updates">{t('publicSiteNavUpdates')}</NavAnchor>
          ) : !installed ? (
            <NavAnchor href="#downloads">{t('landingNavDownloads')}</NavAnchor>
          ) : null}
          <NavAnchor href="#about">{t('landingNavAbout')}</NavAnchor>
          <NavAnchor href="#contact">{t('landingNavContact')}</NavAnchor>
          <Link to="/privacy" className="btn-ghost hidden lg:inline-flex">{t('landingNavPrivacy')}</Link>
          <Link to="/terms" className="btn-ghost hidden lg:inline-flex">{t('landingNavTerms')}</Link>
          <Link to="/security" className="btn-ghost hidden lg:inline-flex">{t('landingNavThreatModel')}</Link>
          <Link to="/vdp" className="btn-ghost hidden lg:inline-flex">{t('landingNavVdp')}</Link>
          <Link to="/status" className="btn-ghost hidden lg:inline-flex">{t('landingNavStatus')}</Link>
          <LanguagePicker className="w-28 hidden sm:flex" />
          {installed ? (
            <>
              <Link to="/login" data-testid="landing-login-link" className="btn-ghost">{t('landingLogin')}</Link>
              <Link to="/register" data-testid="landing-register-link" className="btn-primary">{t('landingRegister')}</Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter({ t }) {
  return (
    <footer className="relative z-10 border-t border-[#27272A] mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-[#71717A]">
          <span>© {new Date().getFullYear()} Super Secure Chat · {SITE_ORIGIN.replace('https://', '')}</span>
          <span>v{APP_VERSION}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-[#A1A1AA] hover:text-white transition" data-testid="landing-privacy-link">
            {t('landingNavPrivacy')}
          </Link>
          <Link to="/terms" className="text-[#A1A1AA] hover:text-white transition" data-testid="landing-terms-link">
            {t('landingNavTerms')}
          </Link>
          <Link to="/security" className="text-[#A1A1AA] hover:text-white transition" data-testid="landing-threat-model-link">
            {t('landingNavThreatModel')}
          </Link>
          <Link to="/vdp" className="text-[#A1A1AA] hover:text-white transition" data-testid="landing-vdp-link">
            {t('landingNavVdp')}
          </Link>
          <Link to="/status" className="text-[#A1A1AA] hover:text-white transition" data-testid="landing-status-link">
            {t('landingNavStatus')}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#A1A1AA] hover:text-white transition">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}

function PublicConstructionLanding({ t }) {
  const bullets = [
    t('publicSiteBulletNoDownloads'),
    t('publicSiteBulletNoBeta'),
    t('publicSiteBulletStage'),
  ];

  const features = [
    { icon: ShieldCheck, titleKey: 'landingFeatureE2eTitle', bodyKey: 'landingFeatureE2eBody' },
    { icon: Clock, titleKey: 'landingFeature24hTitle', bodyKey: 'landingFeature24hBody' },
    { icon: Translate, titleKey: 'landingFeatureTranslateTitle', bodyKey: 'landingFeatureTranslateBody' },
    { icon: Lightning, titleKey: 'landingFeaturePanicTitle', bodyKey: 'landingFeaturePanicBody' },
  ];

  return (
    <>
      <section id="top" className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28" data-testid="public-construction-hero">
        <div className="max-w-3xl fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FFD600]/30 bg-[#FFD600]/10 text-xs text-[#FFD600] mb-6">
            <HardHat size={14} weight="duotone" />
            {t('publicSiteBadge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08]">
            {t('constructionHeadline')}
          </h1>
          <p className="mt-6 text-lg text-[#A1A1AA] leading-relaxed">
            {t('publicSiteHeroSubtitle')}
          </p>
          <ul className="mt-8 space-y-3">
            {bullets.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-[#D4D4D8]">
                <TrafficCone size={18} className="text-[#00E5FF] shrink-0 mt-0.5" weight="duotone" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#updates" className="btn-primary" data-testid="public-construction-updates-cta">
              <Newspaper size={18} weight="bold" />
              {t('publicSiteNavUpdates')}
            </a>
            <a href="#contact" className="btn-secondary">
              <EnvelopeSimple size={18} />
              {t('landingNavContact')}
            </a>
          </div>
        </div>
      </section>

      <section id="updates" className="border-t border-[#27272A]/80 bg-[#0D0D0D]/60" data-testid="public-construction-updates">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <SectionHeading
            label={t('publicSiteUpdatesLabel')}
            title={t('publicSiteUpdatesTitle')}
            body={t('publicSiteUpdatesBody')}
          />

          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <article className="md:col-span-1 rounded-xl border border-[#27272A] bg-[#121212] p-5">
              <p className="text-xs uppercase tracking-widest text-[#71717A]">{t('publicSiteStageLabel')}</p>
              <p className="mt-3 text-lg font-semibold text-[#FFD600]">{t('publicSiteStagePrivateDev')}</p>
              <p className="mt-2 text-sm text-[#A1A1AA]">{t('publicSiteStageVersion', { version: APP_VERSION })}</p>
            </article>
            <div className="md:col-span-2 space-y-4">
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

      <section className="border-t border-[#27272A]/80" data-testid="public-construction-no-downloads">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="rounded-2xl border border-[#27272A] bg-[#121212] p-8 md:p-10 max-w-3xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFD600]/10 flex items-center justify-center shrink-0">
                <DownloadSimple size={26} className="text-[#FFD600]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t('publicSiteNoDownloadsTitle')}</h2>
                <p className="mt-3 text-[#A1A1AA] leading-relaxed">{t('publicSiteNoDownloadsBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <SectionHeading label={t('landingFeaturesLabel')} title={t('landingFeaturesTitle')} />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <article
              key={f.titleKey}
              className="rounded-xl border border-[#27272A] bg-[#121212] p-5 hover:border-[#3F3F46] transition fade-up"
              style={{ animationDelay: `${0.04 * i}s` }}
            >
              <f.icon size={24} className="text-[#00E5FF]" weight="duotone" />
              <h3 className="mt-4 text-base font-semibold">{t(f.titleKey)}</h3>
              <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">{t(f.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="border-t border-[#27272A]/80" data-testid="landing-about-section">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
            <div className="lg:col-span-7">
              <SectionHeading
                label={t('landingAboutLabel')}
                title={t('landingAboutTitle')}
                body={t('landingAboutBody')}
              />
            </div>
            <div className="lg:col-span-5 grid gap-4">
              {[
                { titleKey: 'landingAboutNoPhoneTitle', bodyKey: 'landingAboutNoPhoneBody' },
                { titleKey: 'landingAboutEphemeralTitle', bodyKey: 'landingAboutEphemeralBody' },
                { titleKey: 'landingAboutInstalledTitle', bodyKey: 'landingAboutInstalledBody' },
              ].map((item) => (
                <div key={item.titleKey} className="rounded-xl border border-[#27272A] bg-[#121212] px-5 py-4">
                  <p className="font-medium text-[#F4F4F5]">{t(item.titleKey)}</p>
                  <p className="text-sm text-[#A1A1AA] mt-1.5 leading-relaxed">{t(item.bodyKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-[#27272A]/80 bg-[#0D0D0D]/60" data-testid="landing-contact-section">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div className="rounded-2xl border border-[#27272A] bg-[#121212] p-8 md:p-10 md:flex md:items-center md:justify-between md:gap-10">
            <div className="max-w-xl">
              <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/10 flex items-center justify-center mb-5">
                <EnvelopeSimple size={26} className="text-[#00E5FF]" />
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('landingContactTitle')}</h2>
              <p className="mt-3 text-[#A1A1AA] leading-relaxed">{t('landingContactBody')}</p>
              <p className="mt-3 text-sm text-[#71717A]">{t('publicSiteContactNoBeta')}</p>
            </div>
            <div className="mt-8 md:mt-0 shrink-0">
              <p className="text-xs uppercase tracking-widest text-[#71717A] mb-2">{t('landingContactEmailLabel')}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-xl md:text-2xl font-semibold text-[#00E5FF] hover:brightness-110 transition break-all"
                data-testid="landing-contact-email"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function Landing() {
  const { t } = useLocale();
  const installed = isInstalledClient();
  const publicConstruction = !installed && isSitePublicConstructionMode();

  const features = [
    { icon: ShieldCheck, titleKey: 'landingFeatureE2eTitle', bodyKey: 'landingFeatureE2eBody' },
    { icon: Clock, titleKey: 'landingFeature24hTitle', bodyKey: 'landingFeature24hBody' },
    { icon: Translate, titleKey: 'landingFeatureTranslateTitle', bodyKey: 'landingFeatureTranslateBody' },
    { icon: Lightning, titleKey: 'landingFeaturePanicTitle', bodyKey: 'landingFeaturePanicBody' },
  ];

  return (
    <MarketingPage className="bg-[#0A0A0A] text-[#F0F0F0] relative">
      <div
        aria-hidden
        className="fixed inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="fixed -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#00E5FF] opacity-[0.06] blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[460px] h-[460px] rounded-full bg-[#00E5FF] opacity-[0.04] blur-3xl pointer-events-none" />

      <SiteHeader t={t} installed={installed} publicConstruction={publicConstruction} />

      <main className="relative z-10 flex-1">
        {publicConstruction ? (
          <PublicConstructionLanding t={t} />
        ) : (
          <>
            <section id="top" className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
              <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                <div className="lg:col-span-7 fade-up">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#27272A] bg-[#121212]/80 text-xs text-[#A1A1AA] mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                    {t('landingBadge')}
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08]">
                    {t('landingTitle1')}{' '}
                    <span className="text-[#00E5FF]">{t('landingTitle2')}</span>
                  </h1>
                  <p className="mt-6 text-lg text-[#A1A1AA] max-w-xl leading-relaxed">
                    {installed ? t('landingSubtitle') : t('landingDownloadSubtitle')}
                  </p>

                  {installed ? (
                    <div className="mt-10 flex flex-wrap gap-3">
                      <Link to="/register" data-testid="cta-create-account" className="btn-primary">
                        {t('landingCtaCreate')}
                      </Link>
                      <Link to="/login" data-testid="cta-login" className="btn-secondary">
                        {t('landingCtaLogin')}
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-10 flex flex-wrap gap-3">
                      <a href="#downloads" className="btn-primary" data-testid="landing-hero-download-cta">
                        <DownloadSimple size={18} weight="bold" />
                        {t('landingHeroCtaDownloads')}
                      </a>
                      <a href="#contact" className="btn-secondary">
                        <EnvelopeSimple size={18} />
                        {t('landingNavContact')}
                      </a>
                    </div>
                  )}

                  <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#71717A]">
                    <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#00E5FF]" /> Signal-grade E2E</span>
                    <span className="flex items-center gap-2"><Clock size={16} className="text-[#34C759]" /> 24h default</span>
                    <span className="flex items-center gap-2"><Eye size={16} className="text-[#A1A1AA]" /> Zero-knowledge server</span>
                  </div>
                </div>

                <div className="lg:col-span-5 fade-up" style={{ animationDelay: '0.12s' }}>
                  <div className="rounded-xl border border-[#27272A] bg-[#121212]/90 p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#27272A]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#232323] flex items-center justify-center text-xs font-medium">AX</div>
                        <div>
                          <div className="text-sm font-medium">@alex_x</div>
                          <div className="text-xs text-[#34C759]">Encrypted · Online</div>
                        </div>
                      </div>
                      <div className="text-xs text-[#71717A]">23:54 left</div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex">
                        <div className="bg-[#232323] rounded-lg px-3 py-2.5 max-w-[85%]">
                          Salut! Cum a fost ziua?
                          <div className="text-xs text-[#71717A] mt-1.5">RO → EN: &quot;Hi! How was your day?&quot;</div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#1E2A38] rounded-lg px-3 py-2.5 max-w-[85%]">
                          Pretty good — auto-translated though?
                        </div>
                      </div>
                      <div className="flex">
                        <div className="bg-[#232323] rounded-lg px-3 py-2.5 max-w-[85%]">
                          Da, mereu :)
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-[#71717A]">
                      <Clock size={14} />
                      Messages auto-delete in 24 hours
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {!installed ? (
              <section id="downloads" className="border-t border-[#27272A]/80 bg-[#0D0D0D]/60">
                <div className="max-w-6xl mx-auto px-6 py-20 md:py-24" data-testid="landing-download-panel">
                  <SectionHeading
                    label={t('landingVersionLabel', { version: APP_VERSION })}
                    title={t('landingDownloadsTitle')}
                    body={t('landingDownloadsSubtitle')}
                  />

                  <div className="mt-10 grid md:grid-cols-2 gap-6">
                    <article className="rounded-xl border border-[#27272A] bg-[#121212] p-6 flex flex-col">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center shrink-0">
                          <DeviceMobile size={24} className="text-[#00E5FF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold">{t('landingGetAndroid')}</h3>
                          <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">{t('landingGetAndroidHint')}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
                        {DOWNLOAD_PLAY_STORE_URL ? (
                          <ActionLink
                            href={DOWNLOAD_PLAY_STORE_URL}
                            label={t('landingDownloadPlay')}
                            testId="landing-download-play"
                            external
                            icon={DownloadSimple}
                          />
                        ) : null}
                        <ActionLink
                          href={DOWNLOAD_APK_URL}
                          label={t('landingDownloadApk', { version: APP_VERSION })}
                          testId="landing-download-apk"
                          variant={DOWNLOAD_PLAY_STORE_URL ? 'secondary' : 'primary'}
                          icon={DownloadSimple}
                        />
                        {DOWNLOAD_ANDROID_BETA_URL ? (
                          <ActionLink
                            href={DOWNLOAD_ANDROID_BETA_URL}
                            label={t('landingDownloadBeta')}
                            testId="landing-download-beta"
                            variant="secondary"
                            external
                            icon={UsersThree}
                          />
                        ) : null}
                      </div>
                    </article>

                    <article className="rounded-xl border border-[#27272A] bg-[#121212] p-6 flex flex-col">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center shrink-0">
                          <Desktop size={24} className="text-[#00E5FF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold">{t('landingGetWindows')}</h3>
                          <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">{t('landingGetWindowsHint')}</p>
                        </div>
                      </div>
                      <div className="mt-6">
                        <ActionLink
                          href={DOWNLOAD_WIN_URL}
                          label={t('landingDownloadWin', { version: APP_VERSION })}
                          testId="landing-download-win"
                          icon={DownloadSimple}
                        />
                      </div>
                    </article>
                  </div>

                  {!DOWNLOAD_APK_URL && !DOWNLOAD_WIN_URL ? (
                    <p className="mt-6 text-sm text-[#71717A]">{t('landingDownloadsPending')}</p>
                  ) : null}

                  <p className="mt-8 text-sm text-[#71717A] flex items-center gap-2">
                    <ArrowDown size={16} />
                    {t('landingDownloadBody')}
                  </p>
                </div>
              </section>
            ) : null}

            <section id="features" className="max-w-6xl mx-auto px-6 py-20 md:py-24">
              <SectionHeading label={t('landingFeaturesLabel')} title={t('landingFeaturesTitle')} />
              <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {features.map((f, i) => (
                  <article
                    key={f.titleKey}
                    className="rounded-xl border border-[#27272A] bg-[#121212] p-5 hover:border-[#3F3F46] transition fade-up"
                    style={{ animationDelay: `${0.04 * i}s` }}
                  >
                    <f.icon size={24} className="text-[#00E5FF]" weight="duotone" />
                    <h3 className="mt-4 text-base font-semibold">{t(f.titleKey)}</h3>
                    <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">{t(f.bodyKey)}</p>
                  </article>
                ))}
              </div>
            </section>

            {!installed ? <LandingScreenshots /> : null}

            <section id="about" className="border-t border-[#27272A]/80" data-testid="landing-about-section">
              <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
                <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
                  <div className="lg:col-span-7">
                    <SectionHeading
                      label={t('landingAboutLabel')}
                      title={t('landingAboutTitle')}
                      body={t('landingAboutBody')}
                    />
                  </div>
                  <div className="lg:col-span-5 grid gap-4">
                    {[
                      { titleKey: 'landingAboutNoPhoneTitle', bodyKey: 'landingAboutNoPhoneBody' },
                      { titleKey: 'landingAboutEphemeralTitle', bodyKey: 'landingAboutEphemeralBody' },
                      { titleKey: 'landingAboutInstalledTitle', bodyKey: 'landingAboutInstalledBody' },
                    ].map((item) => (
                      <div key={item.titleKey} className="rounded-xl border border-[#27272A] bg-[#121212] px-5 py-4">
                        <p className="font-medium text-[#F4F4F5]">{t(item.titleKey)}</p>
                        <p className="text-sm text-[#A1A1AA] mt-1.5 leading-relaxed">{t(item.bodyKey)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section id="contact" className="border-t border-[#27272A]/80 bg-[#0D0D0D]/60" data-testid="landing-contact-section">
              <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
                <div className="rounded-2xl border border-[#27272A] bg-[#121212] p-8 md:p-10 md:flex md:items-center md:justify-between md:gap-10">
                  <div className="max-w-xl">
                    <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/10 flex items-center justify-center mb-5">
                      <EnvelopeSimple size={26} className="text-[#00E5FF]" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('landingContactTitle')}</h2>
                    <p className="mt-3 text-[#A1A1AA] leading-relaxed">{t('landingContactBody')}</p>
                  </div>
                  <div className="mt-8 md:mt-0 shrink-0">
                    <p className="text-xs uppercase tracking-widest text-[#71717A] mb-2">{t('landingContactEmailLabel')}</p>
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="text-xl md:text-2xl font-semibold text-[#00E5FF] hover:brightness-110 transition break-all"
                      data-testid="landing-contact-email"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <SiteFooter t={t} />
    </MarketingPage>
  );
}