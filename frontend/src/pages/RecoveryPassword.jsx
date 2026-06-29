import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Key, Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import LanguagePicker from '../components/LanguagePicker';
import {
  parseRecoveryCodesInput,
  RECOVERY_CODE_COUNT,
  resetPasswordWithRecovery,
} from '../lib/recoveryKey';
import { saveVaultCredential } from '../lib/vaultCredentialStore';

export default function RecoveryPassword() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const { t } = useLocale();
  const [identifier, setIdentifier] = useState('');
  const [codesRaw, setCodesRaw] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('settingsPasswordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settingsPasswordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const recoveryCodes = parseRecoveryCodesInput(codesRaw);
      const data = await resetPasswordWithRecovery({
        identifier,
        recoveryCodes,
        newPassword,
      });
      if (data.user?.user_id) await saveVaultCredential(data.user.user_id, newPassword);
      await loginWithToken(data.token, data.user);
      toast.success(t('recoveryResetSuccess'));
      navigate('/chat');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.message === 'RECOVERY_CODE_PARSE') {
        toast.error(t('recoveryCodesInvalid', { count: RECOVERY_CODE_COUNT }));
      } else {
        toast.error(detail || t('recoveryResetFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-shell min-h-screen bg-[#0A0A0A] flex flex-col safe-top safe-bottom">
      <div className="flex justify-end p-4">
        <LanguagePicker />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-8">
        <div className="w-full max-w-sm fade-up">
          <div className="flex items-center gap-2 mb-6">
            <Key size={22} className="text-[#00E5FF]" weight="duotone" />
            <h1 className="font-mono text-sm tracking-[0.3em]">{t('recoveryResetTitle')}</h1>
          </div>
          <p className="text-sm text-[#A1A1AA] mb-5">{t('recoveryResetIntro')}</p>

          <form onSubmit={submit} className="space-y-4" data-testid="recovery-reset-form">
            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">
                {t('emailOrUsername')}
              </label>
              <input
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
                data-testid="recovery-identifier"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">
                {t('recoveryCodesLabel', { count: RECOVERY_CODE_COUNT })}
              </label>
              <textarea
                required
                value={codesRaw}
                onChange={(e) => setCodesRaw(e.target.value)}
                rows={4}
                placeholder={t('recoveryCodesPlaceholder')}
                className="w-full mt-1.5 px-3 py-2.5 text-sm font-mono bg-[#1A1A1A] border border-[#27272A] rounded-md resize-none"
                data-testid="recovery-codes-input"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">
                {t('recoveryNewPassword')}
              </label>
              <div className="relative mt-1.5">
                <input
                  required
                  type={show ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md pr-10"
                  autoComplete="new-password"
                  data-testid="recovery-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white p-1"
                >
                  {show ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">
                {t('settingsConfirmPassword')}
              </label>
              <input
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
                autoComplete="new-password"
                data-testid="recovery-confirm-password"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-50"
              data-testid="recovery-reset-submit"
            >
              {busy ? t('processing') : t('recoveryResetSubmit')}
            </button>
          </form>

          <p className="mt-6 text-sm text-[#A1A1AA] text-center">
            <Link to="/login" className="text-[#00E5FF] hover:underline" data-testid="recovery-back-login">
              {t('recoveryBackToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}