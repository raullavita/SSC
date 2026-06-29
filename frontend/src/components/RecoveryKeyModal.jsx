import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, Key, Copy, Check } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import {
  formatRecoveryCode,
  generateRecoveryCodes,
  regenerateRecoveryKey,
  setupRecoveryKey,
} from '../lib/recoveryKey';

export default function RecoveryKeyModal({ open, onClose, recoveryEnabled }) {
  const { user, refreshUser } = useAuth();
  const { t } = useLocale();
  const [step, setStep] = useState('idle');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setCodes([]);
      setCopied(false);
      setStep(recoveryEnabled ? 'manage' : 'idle');
    }
  }, [open, recoveryEnabled]);

  const runSetup = async (regenerate = false) => {
    if (!user?.encrypted_private_key || !user?.pk_salt) {
      toast.error(t('recoveryNoVault'));
      return;
    }
    setBusy(true);
    try {
      const newCodes = generateRecoveryCodes();
      const payload = {
        password,
        encryptedPrivateKey: user.encrypted_private_key,
        pkSalt: user.pk_salt,
        recoveryCodes: newCodes,
      };
      if (regenerate) await regenerateRecoveryKey(payload);
      else await setupRecoveryKey(payload);
      setCodes(newCodes);
      setStep('codes');
      await refreshUser();
      toast.success(regenerate ? t('recoveryRegenerated') : t('recoveryCreated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('recoveryFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(
        codes.map((c) => formatRecoveryCode(c)).join(' '),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-5 fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="recovery-key-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-[#00E5FF]" weight="duotone" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('recoveryTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="recovery-close">
            <X size={16} />
          </button>
        </div>

        {step === 'idle' && (
          <>
            <p className="text-sm text-[#A1A1AA]">{t('recoveryIntro')}</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('recoveryPasswordPlaceholder')}
              className="w-full mt-4 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
              autoComplete="current-password"
              data-testid="recovery-setup-password"
            />
            <button
              type="button"
              disabled={busy || !password}
              onClick={() => runSetup(false)}
              className="w-full mt-4 py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40"
              data-testid="recovery-setup-button"
            >
              {busy ? t('processing') : t('recoveryCreate')}
            </button>
          </>
        )}

        {step === 'manage' && (
          <>
            <p className="text-sm text-[#A1A1AA]">{t('recoveryManageHint')}</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('recoveryPasswordPlaceholder')}
              className="w-full mt-4 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
              autoComplete="current-password"
              data-testid="recovery-regen-password"
            />
            <button
              type="button"
              disabled={busy || !password}
              onClick={() => runSetup(true)}
              className="w-full mt-4 py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323] disabled:opacity-40"
              data-testid="recovery-regenerate-button"
            >
              {busy ? t('processing') : t('recoveryRegenerate')}
            </button>
          </>
        )}

        {step === 'codes' && (
          <>
            <p className="text-sm text-[#A1A1AA]">{t('recoveryCodesHint')}</p>
            <div
              className="font-mono text-xs bg-[#1A1A1A] p-3 rounded mt-3 grid grid-cols-2 gap-2"
              data-testid="recovery-codes-display"
            >
              {codes.map((code) => (
                <span key={code}>{formatRecoveryCode(code)}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={copyCodes}
              className="mt-2 px-2 py-1 text-xs font-mono tac-border bg-[#121212] hover:bg-[#1A1A1A] rounded flex items-center gap-1"
              data-testid="recovery-copy-codes"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? t('copied') : t('recoveryCopyCodes')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-4 py-2.5 text-sm border border-[#27272A] rounded-md hover:bg-[#1A1A1A]"
            >
              {t('recoverySavedConfirm')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}