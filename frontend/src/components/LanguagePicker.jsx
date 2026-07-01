import React from 'react';
import { Translate } from '@phosphor-icons/react';
import { LANGS } from '../lib/i18n';
import { useLocale } from '../context/LocaleContext';

/** Compact language selector — updates app UI immediately. */
export default function LanguagePicker({ className = '' }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Translate size={14} className="text-[#A1A1AA] shrink-0" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        data-testid="ui-language-picker"
        className="flex-1 min-w-0 max-w-full px-2 py-1.5 text-xs bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
        aria-label={t('appLanguage')}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}