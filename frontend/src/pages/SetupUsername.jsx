import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, X, LockKey } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

import { generateRSAKeypair, wrapPrivateKey } from '../lib/crypto';
import { LANGS } from '../lib/i18n';
import { bootstrapSignalIdentity } from '../lib/signalIdentityBootstrap';
import { isInstalledClient } from '../lib/platform';

export default function SetupUsername() {
  const navigate = useNavigate();
  const { user, refreshUser, persistPrivateKey } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState({ checking: false, available: null, reason: '' });
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState(user?.language || locale);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
  }, [user, navigate]);

  useEffect(() => {
    if (!username) { setStatus({ checking: false, available: null, reason: '' }); return; }
    setStatus({ checking: true, available: null, reason: '' });
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/check-username', { username });
        setStatus({ checking: false, available: data.available, reason: data.reason || '' });
      } catch {
        setStatus({ checking: false, available: false, reason: t('checkFailed') });
      }
    }, 350);
    return () => ref.current && clearTimeout(ref.current);
  }, [username, t]);

  const onLanguageChange = (code) => {
    setLanguage(code);
    setLocale(code);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (status.available !== true || password.length < 8) return;
    setBusy(true);
    try {
      toast.message(t('setupGenerating'));
      const { publicKeyJwk, privateKeyJwk } = await generateRSAKeypair();
      const wrapped = await wrapPrivateKey(privateKeyJwk, password);
      await api.post('/auth/google/finish-setup', {
        username, language,
        public_key: JSON.stringify(publicKeyJwk),
        encrypted_private_key: wrapped.encrypted_private_key,
        pk_salt: wrapped.pk_salt,
      });
      const pk = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
      await persistPrivateKey(pk);
      await refreshUser();
      if (isInstalledClient()) {
        const boot = await bootstrapSignalIdentity(refreshUser);
        if (!boot.ok) {
          toast.error(t('signalIdentityRequired'));
          return;
        }
      }
      toast.success(t('setupComplete'));
      navigate('/chat');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('setupFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-6">
      <div className="w-full max-w-sm fade-up">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-md bg-[#00E5FF] flex items-center justify-center">
            <LockKey size={18} weight="bold" className="text-black" />
          </div>
          <span className="font-mono text-sm tracking-[0.25em]">SSC · SETUP</span>
        </div>
        <h1 className="font-mono text-2xl font-bold tracking-tighter">{t('setupTitle')}</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">{t('setupSubtitle')}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('username')}</label>
            <div className="relative">
              <input data-testid="setup-username-input" required minLength={4} maxLength={12} value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                className="w-full mt-1.5 px-3 py-2.5 text-sm pr-10 font-mono" placeholder={t('usernamePlaceholder')} />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {status.checking && <span className="text-[10px] font-mono text-[#A1A1AA]">…</span>}
                {status.available === true && <Check size={16} className="text-[#34C759]" />}
                {status.available === false && <X size={16} className="text-[#FF3B30]" />}
              </div>
            </div>
            {status.reason && <p className="mt-1 text-[11px] text-[#FF3B30]" data-testid="setup-username-error">{status.reason}</p>}
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('setupPassword')}</label>
            <input data-testid="setup-password-input" type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} className="w-full mt-1.5 px-3 py-2.5 text-sm" placeholder="••••••••" />
            <p className="mt-1 text-[10px] text-[#A1A1AA] font-mono">{t('setupPasswordHint')}</p>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('preferredLanguage')}</label>
            <select data-testid="setup-language-select" value={language} onChange={(e) => onLanguageChange(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={status.available !== true || password.length < 8 || busy} data-testid="setup-submit-button"
            className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40">
            {busy ? t('setupGenerating').toUpperCase() : t('setupFinish').toUpperCase()}
          </button>
        </form>
      </div>
    </div>
  );
}