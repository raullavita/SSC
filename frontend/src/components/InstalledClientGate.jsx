import React from 'react';
import { Link } from 'react-router-dom';
import { DeviceMobile, Desktop } from '@phosphor-icons/react';
import { isBrowserDevAllowed, isInstalledClient } from '../lib/platform';
import { useLocale } from '../context/LocaleContext';

/**
 * Blocks browser-tab register/login/chat — SSC is installed-apps only.
 * Founder LAN dev: set REACT_APP_BROWSER_DEV=true in frontend/.env
 */
export default function InstalledClientGate({ children }) {
  const { t } = useLocale();

  if (isInstalledClient() || isBrowserDevAllowed()) {
    return children;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center fade-up">
        <h1 className="font-mono text-2xl font-bold tracking-tight mb-3">{t('installRequiredTitle')}</h1>
        <p className="text-sm text-[#A1A1AA] mb-8 leading-relaxed">{t('installRequiredBody')}</p>
        <div className="flex flex-col gap-3 text-left">
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
        <Link
          to="/"
          className="inline-block mt-8 px-5 py-2.5 text-sm border border-[#27272A] rounded-md hover:bg-[#1A1A1A] transition"
        >
          {t('installRequiredBack')}
        </Link>
      </div>
    </div>
  );
}