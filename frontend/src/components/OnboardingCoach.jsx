import React, { useState } from 'react';
import { DeviceMobile, ShieldCheck, Warning } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { getPlatform, isElectronApp, isNativeApp } from '../lib/platform';

function onboardingPlatformSuffix() {
  if (isElectronApp()) return 'desktop';
  if (isNativeApp()) return getPlatform() || 'native';
  return 'web';
}

const STEPS = [
  { icon: DeviceMobile, titleKey: 'onboardingStep1Title', bodyKey: 'onboardingStep1Body' },
  { icon: ShieldCheck, titleKey: 'onboardingStep2Title', bodyKey: 'onboardingStep2Body' },
  { icon: Warning, titleKey: 'onboardingStep3Title', bodyKey: 'onboardingStep3Body' },
];

export function onboardingStorageKey(userId) {
  return `ssc_onboarding_v1_${onboardingPlatformSuffix()}_${userId || 'anon'}`;
}

export function hasCompletedOnboarding(userId) {
  if (typeof window === 'undefined' || !userId) return true;
  return localStorage.getItem(onboardingStorageKey(userId)) === '1';
}

export function markOnboardingComplete(userId) {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.setItem(onboardingStorageKey(userId), '1');
}

export default function OnboardingCoach({ open, userId, onComplete }) {
  const { t } = useLocale();
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step >= STEPS.length - 1;

  const finish = () => {
    markOnboardingComplete(userId);
    onComplete?.();
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
      data-testid="onboarding-coach"
    >
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-5 fade-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-[#00E5FF]/15 flex items-center justify-center">
            <Icon size={22} className="text-[#00E5FF]" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#A1A1AA] tracking-widest uppercase">
              {t('onboardingLabel')} {step + 1}/{STEPS.length}
            </div>
            <h2 className="font-mono text-sm font-semibold mt-0.5">{t(current.titleKey)}</h2>
          </div>
        </div>

        <p className="text-sm text-[#A1A1AA] leading-relaxed">{t(current.bodyKey)}</p>

        <div className="flex gap-1.5 mt-5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#00E5FF]' : 'bg-[#27272A]'}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-2.5 text-sm border border-[#27272A] rounded-md hover:bg-[#1A1A1A]"
              data-testid="onboarding-back"
            >
              {t('back')}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="flex-1 py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110"
            data-testid={isLast ? 'onboarding-finish' : 'onboarding-next'}
          >
            {isLast ? t('onboardingFinish') : t('onboardingNext')}
          </button>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="w-full mt-3 text-xs text-[#71717A] hover:text-[#A1A1AA]"
            data-testid="onboarding-skip"
          >
            {t('onboardingSkip')}
          </button>
        )}
      </div>
    </div>
  );
}