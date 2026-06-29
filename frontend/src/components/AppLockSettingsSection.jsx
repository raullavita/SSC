import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LockKey } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { useAppLock } from '../context/AppLockContext';
import { isBiometricUnlockAvailable } from '../lib/appLockBiometric';
import {
  hasAppLockPin,
  isValidPin,
  setAppLockPin,
  verifyAppLockPin,
} from '../lib/appLockPin';
import {
  isAppLockBiometricPrefEnabled,
  isAppLockEnabled,
  isAppLockFeatureAvailable,
  setAppLockBiometricPrefEnabled,
  setAppLockEnabled,
} from '../lib/appLockStore';

function Section({ icon: Icon, title, children, testId }) {
  return (
    <section className="mb-6" data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-[#00E5FF]" />
        <h3 className="text-xs font-mono tracking-widest uppercase text-[#A1A1AA]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function AppLockSettingsSection() {
  const { t } = useLocale();
  const { refreshAvailability } = useAppLock();
  const [enabled, setEnabled] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAppLockFeatureAvailable()) return;
    setEnabled(isAppLockEnabled());
    setBiometric(isAppLockBiometricPrefEnabled());
    hasAppLockPin().then(setPinSet);
    isBiometricUnlockAvailable().then(setBioAvailable);
  }, []);

  if (!isAppLockFeatureAvailable()) return null;

  const savePin = async () => {
    if (!isValidPin(pin)) {
      toast.error(t('settingsAppLockPinTooShort'));
      return;
    }
    if (pin !== pinConfirm) {
      toast.error(t('settingsAppLockPinMismatch'));
      return;
    }
    if (pinSet) {
      const ok = await verifyAppLockPin(currentPin);
      if (!ok) {
        toast.error(t('appLockWrongPin'));
        return;
      }
    }
    setBusy(true);
    try {
      await setAppLockPin(pin);
      setAppLockEnabled(true);
      setEnabled(true);
      setPinSet(true);
      setPin('');
      setPinConfirm('');
      setCurrentPin('');
      await refreshAvailability();
      toast.success(t('settingsAppLockPinSet'));
    } catch {
      toast.error(t('couldNotSave'));
    } finally {
      setBusy(false);
    }
  };

  const onToggleEnabled = async (next) => {
    if (next && !pinSet) {
      toast.info(t('settingsAppLockSetPin'));
      return;
    }
    setAppLockEnabled(next);
    setEnabled(next);
    if (!next) setAppLockBiometricPrefEnabled(false);
    setBiometric(next ? biometric : false);
    await refreshAvailability();
    toast.success(next ? t('settingsAppLockEnabled') : t('settingsAppLockDisabled'));
  };

  const onToggleBiometric = (next) => {
    setAppLockBiometricPrefEnabled(next);
    setBiometric(next);
  };

  return (
    <Section icon={LockKey} title={t('settingsAppLock')} testId="settings-app-lock-section">
      <p className="text-xs text-[#71717A] mb-3">{t('settingsAppLockHint')}</p>

      <label className="flex items-center justify-between py-2 text-sm text-[#F0F0F0]">
        <span>{t('settingsAppLockEnable')}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
          data-testid="settings-app-lock-enabled"
        />
      </label>

      {bioAvailable && (
        <label className="flex items-center justify-between py-2 text-sm text-[#F0F0F0]">
          <span>{t('settingsAppLockBiometric')}</span>
          <input
            type="checkbox"
            checked={biometric}
            disabled={!enabled}
            onChange={(e) => onToggleBiometric(e.target.checked)}
            data-testid="settings-app-lock-biometric"
          />
        </label>
      )}

      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-mono tracking-wider text-[#71717A]">
          {pinSet ? t('settingsAppLockChangePin') : t('settingsAppLockSetPin')}
        </p>
        {pinSet && (
          <input
            type="password"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            placeholder={t('appLockPinPlaceholder')}
            className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
            data-testid="settings-app-lock-current-pin"
          />
        )}
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={t('settingsAppLockPinConfirm')}
          className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
          data-testid="settings-app-lock-new-pin"
        />
        <input
          type="password"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value)}
          placeholder={t('settingsAppLockPinConfirm')}
          className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
          data-testid="settings-app-lock-confirm-pin"
        />
        <button
          type="button"
          onClick={savePin}
          disabled={busy}
          className="w-full py-2 text-xs rounded-md border border-[#27272A] hover:bg-[#1A1A1A] disabled:opacity-40"
          data-testid="settings-app-lock-save-pin"
        >
          {busy ? t('processing') : (pinSet ? t('settingsAppLockChangePin') : t('settingsAppLockSetPin'))}
        </button>
      </div>
    </Section>
  );
}