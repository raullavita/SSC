import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, Gear, Translate, Code } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { LANGS } from '../lib/i18n';
import {
  COPYLEFT_NOTICES,
  SSC_LICENSE_LABEL,
  SSC_SOURCE_REPO_URL,
} from '../lib/openSourceLicenses';

export default function SettingsModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const { t, setLocale } = useLocale();
  const [language, setLanguage] = useState(user?.language || 'en');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && user) setLanguage(user.language || 'en');
  }, [open, user]);

  const saveLanguage = async () => {
    setBusy(true);
    try {
      await api.patch('/users/me', { language });
      await refreshUser();
      setLocale(language);
      toast.success(t('settingsSaved'));
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotSave'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gear size={18} className="text-[#00E5FF]" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('settings').toUpperCase()}</h3>
          </div>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="settings-close"><X size={16} /></button>
        </div>

        <div className="mb-4 p-3 bg-[#1A1A1A] rounded-md tac-border">
          <div className="text-[10px] font-mono text-[#A1A1AA] mb-1">{t('settingsAccount').toUpperCase()}</div>
          <div className="text-sm truncate">{user?.email}</div>
          <div className="text-xs font-mono text-[#A1A1AA] mt-1">@{user?.username}</div>
        </div>

        <div>
          <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA] flex items-center gap-1">
            <Translate size={12} /> {t('settingsLanguage')}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full mt-2 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
            data-testid="settings-language-select"
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <p className="mt-2 text-[10px] text-[#A1A1AA] normal-case tracking-normal">{t('settingsLanguageHint')}</p>
        </div>

        <button
          type="button"
          onClick={saveLanguage}
          disabled={busy || language === (user?.language || 'en')}
          data-testid="settings-save-language"
          className="w-full mt-4 py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40"
        >
          {t('settingsSave').toUpperCase()}
        </button>

        <div className="mt-6 pt-4 border-t border-[#27272A]" data-testid="settings-open-source">
          <div className="flex items-center gap-2 mb-2">
            <Code size={14} className="text-[#00E5FF]" />
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">
              {t('settingsOpenSource')}
            </span>
          </div>
          <p className="text-[10px] text-[#A1A1AA] normal-case tracking-normal mb-2">
            {t('settingsOpenSourceHint')}
          </p>
          <p className="text-[10px] font-mono text-[#71717A] mb-2">{SSC_LICENSE_LABEL}</p>
          <a
            href={SSC_SOURCE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#00E5FF] hover:underline break-all"
            data-testid="settings-source-link"
          >
            {SSC_SOURCE_REPO_URL}
          </a>
          <ul className="mt-3 space-y-2">
            {COPYLEFT_NOTICES.map((n) => (
              <li key={n.id} className="text-[10px] text-[#A1A1AA]">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[#F0F0F0] hover:text-[#00E5FF]">
                  {n.name}
                </a>
                {' · '}
                {n.version}
                {' · '}
                {n.license}
                {!n.shippedInAndroid ? ` · ${t('settingsOpenSourcePlanned')}` : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}