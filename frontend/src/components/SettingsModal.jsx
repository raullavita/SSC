import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  X, Gear, Translate, Code, ShieldCheck, Warning, LockKey, UserCircle, Camera,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { LANGS } from '../lib/i18n';
import { isElectronApp, isInstalledClient, isNativeApp } from '../lib/platform';
import { userHasUnifiedIdentity } from '../lib/signalIdentityBootstrap';
import { prepareAvatarFile } from '../lib/avatarUpload';
import {
  COPYLEFT_NOTICES,
  SSC_LICENSE_LABEL,
  SSC_SOURCE_REPO_URL,
} from '../lib/openSourceLicenses';
import Avatar from './Avatar';
import TwoFAModal from './TwoFAModal';

const APP_VERSION = process.env.REACT_APP_SSC_VERSION || '1.0.0';

function platformLabel(t) {
  if (isNativeApp()) return t('settingsPlatformAndroid');
  if (isElectronApp()) return t('settingsPlatformDesktop');
  if (isInstalledClient()) return t('settingsPlatformInstalled');
  return t('settingsPlatformDev');
}

function Section({ icon: Icon, title, children, testId }) {
  return (
    <section className="mb-5" data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-[#00E5FF]" />
        <h4 className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{title}</h4>
      </div>
      {children}
    </section>
  );
}

export default function SettingsModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const { t, setLocale } = useLocale();
  const [language, setLanguage] = useState(user?.language || 'en');
  const [username, setUsername] = useState(user?.username || '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (open && user) {
      setLanguage(user.language || 'en');
      setUsername(user.username || '');
    }
  }, [open, user]);

  const saveProfile = async () => {
    setBusy(true);
    try {
      const payload = {};
      if (language !== (user?.language || 'en')) payload.language = language;
      if (username.trim() && username !== user?.username) payload.username = username.trim();
      if (Object.keys(payload).length === 0) {
        onClose?.();
        return;
      }
      await api.patch('/users/me', payload);
      await refreshUser();
      if (payload.language) setLocale(payload.language);
      toast.success(t('settingsSaved'));
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotSave'));
    } finally {
      setBusy(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const prepared = await prepareAvatarFile(file);
      const form = new FormData();
      form.append('file', prepared);
      await api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      toast.success(t('settingsAvatarUpdated'));
    } catch (err) {
      const code = err?.message;
      if (code === 'AVATAR_TYPE') toast.error(t('settingsAvatarTypeError'));
      else if (code === 'AVATAR_TOO_LARGE') toast.error(t('settingsAvatarSizeError'));
      else toast.error(err?.response?.data?.detail || t('settingsAvatarFailed'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await api.delete('/users/me/avatar');
      await refreshUser();
      toast.success(t('settingsAvatarRemoved'));
    } catch {
      toast.error(t('settingsAvatarFailed'));
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!open) return null;

  const messagesProtected = userHasUnifiedIdentity(user);
  const profileDirty = language !== (user?.language || 'en') || username.trim() !== (user?.username || '');

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-10 px-4 pb-8" onClick={onClose}>
        <div
          className="w-full max-w-md bg-[#121212] tac-border rounded-md fade-up max-h-[88vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] shrink-0">
            <div className="flex items-center gap-2">
              <Gear size={18} className="text-[#00E5FF]" />
              <h3 className="font-mono text-xs tracking-[0.25em]">{t('settings').toUpperCase()}</h3>
            </div>
            <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="settings-close">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 flex-1">
            <Section icon={UserCircle} title={t('settingsProfile')} testId="settings-profile-section">
              <div className="flex items-center gap-4 p-3 bg-[#1A1A1A] rounded-md tac-border">
                <div className="relative">
                  <Avatar user={user} size="lg" />
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#00E5FF] text-black flex items-center justify-center shadow-lg"
                    data-testid="settings-avatar-upload"
                  >
                    <Camera size={14} weight="bold" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{user?.email}</div>
                  <div className="text-xs font-mono text-[#71717A] mt-1" data-testid="settings-app-version">
                    {t('settingsVersion')} {APP_VERSION} · {platformLabel(t)}
                  </div>
                  {user?.avatar && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={avatarBusy}
                      className="mt-2 text-[10px] font-mono text-[#FF3B30] hover:underline"
                      data-testid="settings-avatar-remove"
                    >
                      {t('settingsRemoveAvatar')}
                    </button>
                  )}
                </div>
              </div>

              <label className="block mt-3 text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                {t('username')}
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12))}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
                data-testid="settings-username-input"
              />
            </Section>

            <Section icon={ShieldCheck} title={t('settingsSecurity')} testId="settings-security-section">
              <div className="p-3 bg-[#1A1A1A] rounded-md tac-border space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#A1A1AA]">{t('settingsMessagesProtected')}</span>
                  <span className={`font-mono ${messagesProtected ? 'text-[#34C759]' : 'text-[#FF9500]'}`}>
                    {messagesProtected ? t('settingsStatusReady') : t('settingsStatusPending')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#A1A1AA]">{t('settingsTwoFa')}</span>
                  <span className={`font-mono ${user?.totp_enabled ? 'text-[#34C759]' : 'text-[#71717A]'}`}>
                    {user?.totp_enabled ? t('on') : t('off')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setTwoFAOpen(true)}
                  className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323]"
                  data-testid="settings-open-2fa"
                >
                  {user?.totp_enabled ? t('settingsManage2fa') : t('settingsEnable2fa')}
                </button>
              </div>

              <div className="mt-3 p-2.5 rounded-md border border-[#FF3B30]/30 bg-[#FF3B30]/5 flex gap-2">
                <Warning size={14} className="text-[#FF3B30] shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#A1A1AA] leading-relaxed normal-case">{t('settingsPanicHint')}</p>
              </div>
            </Section>

            <Section icon={Translate} title={t('settingsPreferences')} testId="settings-preferences-section">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
                data-testid="settings-language-select"
              >
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <p className="mt-2 text-[10px] text-[#71717A]">{t('settingsLanguageHint')}</p>
            </Section>

            <Section icon={Code} title={t('settingsOpenSource')} testId="settings-open-source">
              <p className="text-[10px] text-[#A1A1AA] mb-2">{t('settingsOpenSourceHint')}</p>
              <p className="text-[10px] font-mono text-[#71717A] mb-2">{SSC_LICENSE_LABEL}</p>
              <a href={SSC_SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00E5FF] hover:underline break-all" data-testid="settings-source-link">
                {SSC_SOURCE_REPO_URL}
              </a>
            </Section>

            <p className="text-[10px] text-[#71717A] leading-relaxed flex gap-2 items-start">
              <LockKey size={12} className="shrink-0 mt-0.5 text-[#00E5FF]" />
              {t('settingsInstalledOnlyHint')}
            </p>
          </div>

          <div className="px-4 py-3 border-t border-[#27272A] shrink-0">
            <button
              type="button"
              onClick={saveProfile}
              disabled={busy || !profileDirty}
              data-testid="settings-save"
              className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40"
            >
              {busy ? t('processing') : t('settingsSaveChanges')}
            </button>
          </div>
        </div>
      </div>

      <TwoFAModal open={twoFAOpen} onClose={() => { setTwoFAOpen(false); refreshUser(); }} />
    </>
  );
}