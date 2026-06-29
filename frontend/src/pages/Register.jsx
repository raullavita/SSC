import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LockKey, GoogleLogo, Check, X } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

import { generateRSAKeypair, wrapPrivateKey } from '../lib/crypto';
import Turnstile from '../components/Turnstile';
import LanguagePicker from '../components/LanguagePicker';
import { fetchGoogleConfig, signInWithGoogle } from '../lib/google-auth';
import { MESSAGE_LANGS } from '../lib/translation/translationLanguages';
import { bootstrapSignalIdentity } from '../lib/signalIdentityBootstrap';
import { isInstalledClient } from '../lib/platform';
import { saveVaultCredential } from '../lib/vaultCredentialStore';

export default function Register() {
  const navigate = useNavigate();
  const { loginWithToken, persistPrivateKey, refreshUser } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [language, setLanguage] = useState(locale);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [unameStatus, setUnameStatus] = useState({ checking: false, available: null, reason: '' });
  const [busy, setBusy] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const debounceRef = useRef(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetchGoogleConfig().then((c) => setGoogleEnabled(!!c.enabled));
  }, []);

  useEffect(() => {
    if (!username) { setUnameStatus({ checking: false, available: null, reason: '' }); return; }
    setUnameStatus({ checking: true, available: null, reason: '' });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/check-username', { username });
        setUnameStatus({ checking: false, available: data.available, reason: data.reason || '' });
      } catch {
        setUnameStatus({ checking: false, available: false, reason: t('checkFailed') });
      }
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [username, t]);

  const passwordOk = password.length >= 8;
  const matchOk = password && password === confirm;
  const canSubmit = email && passwordOk && matchOk && unameStatus.available === true && !busy;

  const onLanguageChange = (code) => {
    setLanguage(code);
    setLocale(code);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      toast.message(t('generatingKeys'));
      const { publicKeyJwk, privateKeyJwk } = await generateRSAKeypair();
      const wrapped = await wrapPrivateKey(privateKeyJwk, password);
      const { data } = await api.post('/auth/register', {
        email, password, username, language,
        public_key: JSON.stringify(publicKeyJwk),
        encrypted_private_key: wrapped.encrypted_private_key,
        pk_salt: wrapped.pk_salt,
        captcha_token: captchaToken,
      });
      if (data.verification_required) {
        setPendingVerification({
          email: data.email || email,
          devUrl: data.dev_verification_url || null,
        });
        toast.success(t('emailVerifyCheckInbox'));
        return;
      }
      await loginWithToken(data.token, data.user);
      const pk = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
      await persistPrivateKey(pk);
      await saveVaultCredential(data.user.user_id, password);
      if (isInstalledClient()) {
        const boot = await bootstrapSignalIdentity(refreshUser);
        if (!boot.ok) {
          toast.error(t('signalIdentityRequired'));
          return;
        }
      }
      toast.success(t('accountCreated'));
      navigate('/chat');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('registrationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const loginGoogle = async () => {
    if (busy) return;
    await signInWithGoogle({
      loginWithToken,
      navigate,
      refreshUser,
      onBusy: setBusy,
      onError: (msg) => toast.error(msg || t('googleSignInFailed')),
    });
  };

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] relative">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(0,229,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.4) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-sm fade-up">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2" data-testid="back-to-landing">
              <div className="w-8 h-8 rounded-md bg-[#00E5FF] flex items-center justify-center">
                <LockKey size={18} weight="bold" className="text-black" />
              </div>
              <span className="font-mono text-sm tracking-[0.25em]">SSC</span>
            </Link>
            <LanguagePicker className="w-36" />
          </div>
          <h1 className="font-mono text-3xl font-bold tracking-tighter">
            {pendingVerification ? t('emailVerifyCheckInboxTitle') : t('registerTitle')}
          </h1>
          <p className="text-[#A1A1AA] text-sm mt-2">
            {pendingVerification ? t('emailVerifyCheckInboxBody', { email: pendingVerification.email }) : t('registerSubtitle')}
          </p>

          {pendingVerification ? (
            <div className="mt-6 space-y-4" data-testid="register-verification-pending">
              {pendingVerification.devUrl && (
                <p className="text-[10px] font-mono text-[#A1A1AA] break-all">
                  {t('emailVerifyDevLink')}: {pendingVerification.devUrl}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                data-testid="register-resend-verification"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { data } = await api.post('/auth/resend-verification', {
                      email: pendingVerification.email,
                    });
                    if (data?.dev_verification_url) {
                      setPendingVerification((cur) => ({ ...cur, devUrl: data.dev_verification_url }));
                    }
                    toast.success(t('emailVerifyResent'));
                  } catch (err) {
                    toast.error(err?.response?.data?.detail || t('emailVerifyResendFailed'));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="w-full py-2.5 border border-[#27272A] bg-[#121212] rounded-md text-sm hover:bg-[#1A1A1A] transition disabled:opacity-40"
              >
                {t('emailVerifyResend')}
              </button>
              <p className="text-sm text-[#A1A1AA] text-center">
                <Link to="/login" className="text-[#00E5FF] hover:underline">{t('signIn')}</Link>
              </p>
            </div>
          ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('username')}</label>
              <div className="relative">
                <input
                  data-testid="register-username-input"
                  required minLength={4} maxLength={12} value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  className="w-full mt-1.5 px-3 py-2.5 text-sm pr-10 font-mono" placeholder={t('usernamePlaceholder')}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {unameStatus.checking && <span className="text-[10px] font-mono text-[#A1A1AA]">…</span>}
                  {unameStatus.available === true && <Check size={16} className="text-[#34C759]" />}
                  {unameStatus.available === false && <X size={16} className="text-[#FF3B30]" />}
                </div>
              </div>
              {unameStatus.reason && (
                <p className="mt-1 text-[11px] text-[#FF3B30]" data-testid="username-error">{unameStatus.reason}</p>
              )}
              {unameStatus.available === true && (
                <p className="mt-1 text-[11px] text-[#34C759]" data-testid="username-ok">{t('usernameAvailable', { username })}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('email')}</label>
              <input data-testid="register-email-input" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} className="w-full mt-1.5 px-3 py-2.5 text-sm" placeholder={t('emailInputPlaceholder')} />
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('passwordMin8')}</label>
              <input data-testid="register-password-input" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} className="w-full mt-1.5 px-3 py-2.5 text-sm" placeholder="••••••••" />
              {password && !passwordOk && <p className="mt-1 text-[11px] text-[#FF3B30]">{t('passwordTooShort')}</p>}
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('confirmPassword')}</label>
              <input data-testid="register-confirm-input" type="password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className="w-full mt-1.5 px-3 py-2.5 text-sm" placeholder="••••••••" />
              {confirm && !matchOk && <p className="mt-1 text-[11px] text-[#FF3B30]">{t('passwordsNoMatch')}</p>}
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('preferredLanguage')}</label>
              <select data-testid="register-language-select" value={language} onChange={(e) => onLanguageChange(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]">
                {MESSAGE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-[#A1A1AA] font-mono">{t('registerLangHint')}</p>
            </div>

            <Turnstile onToken={setCaptchaToken} />

            <button type="submit" disabled={!canSubmit} data-testid="register-submit-button"
              className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40">
              {busy ? t('forgingKeys').toUpperCase() : t('createAccount').toUpperCase()}
            </button>
          </form>
          )}

          {!pendingVerification && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#27272A]" />
                <span className="text-[10px] font-mono text-[#A1A1AA] tracking-[0.25em]">{t('or')}</span>
                <div className="flex-1 h-px bg-[#27272A]" />
              </div>

              <button
                onClick={loginGoogle}
                disabled={busy || !googleEnabled}
                data-testid="register-google-button"
                className="w-full py-2.5 border border-[#27272A] bg-[#121212] hover:bg-[#1A1A1A] rounded-md flex items-center justify-center gap-2 text-sm transition disabled:opacity-40"
              >
                <GoogleLogo size={18} weight="bold" /> {googleEnabled ? t('continueGoogle') : t('googleNotConfigured')}
              </button>

              <p className="mt-6 text-sm text-[#A1A1AA] text-center">
                {t('alreadyHaveAccount')}{' '}
                <Link to="/login" data-testid="goto-login" className="text-[#00E5FF] hover:underline">{t('signIn')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}