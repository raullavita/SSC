import React, { useEffect, useState } from 'react';
import { Fingerprint, LockKey } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { useAppLock } from '../context/AppLockContext';

export default function AppLockGate() {
  const { t } = useLocale();
  const {
    unlockWithPin,
    unlockWithBiometric,
    biometricAvailable,
    biometricEnabled,
  } = useAppLock();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const tryBiometric = async () => {
    setError(null);
    setBusy(true);
    try {
      await unlockWithBiometric(t('appLockTitle'));
    } catch {
      setError(t('appLockBiometricFailed'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (biometricAvailable && biometricEnabled) {
      tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockWithPin(pin);
      setPin('');
    } catch (e) {
      setError(e?.message === 'WRONG_PIN' ? t('appLockWrongPin') : t('appLockBiometricFailed'));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#0A0A0A] p-6 safe-top safe-bottom"
      data-testid="app-lock-gate"
    >
      <div className="w-full max-w-sm rounded-xl border border-[#27272A] bg-[#121212] p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <LockKey size={28} className="text-[#00E5FF]" weight="duotone" />
          <div>
            <h1 className="text-lg font-semibold text-[#F0F0F0]">{t('appLockTitle')}</h1>
            <p className="text-xs text-[#A1A1AA] mt-0.5">{t('appLockSubtitle')}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t('appLockPinPlaceholder')}
            className="w-full px-3 py-3 text-center text-lg tracking-[0.35em] bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
            data-testid="app-lock-pin-input"
            disabled={busy}
          />
          {error && (
            <p className="text-xs text-[#FF3B30] text-center" data-testid="app-lock-error">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy || pin.length < 4}
            className="w-full py-2.5 rounded-md bg-[#00E5FF] text-black font-medium text-sm disabled:opacity-40"
            data-testid="app-lock-unlock-button"
          >
            {t('appLockUnlock')}
          </button>
        </form>

        {biometricAvailable && biometricEnabled && (
          <button
            type="button"
            onClick={tryBiometric}
            disabled={busy}
            className="mt-4 w-full py-2.5 rounded-md border border-[#27272A] text-[#F0F0F0] text-sm flex items-center justify-center gap-2 hover:bg-[#1A1A1A] disabled:opacity-40"
            data-testid="app-lock-biometric-button"
          >
            <Fingerprint size={18} className="text-[#00E5FF]" />
            {t('appLockUseBiometric')}
          </button>
        )}
      </div>
    </div>
  );
}