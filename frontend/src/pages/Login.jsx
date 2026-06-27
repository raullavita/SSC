import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LockKey, GoogleLogo, Eye, EyeSlash, ShieldCheck } from '@phosphor-icons/react';
import { api, API } from '../lib/api';
import { isNativeApp } from '../lib/platform';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import Turnstile from '../components/Turnstile';
import LanguagePicker from '../components/LanguagePicker';
import { fetchGoogleConfig, signInWithGoogle } from '../lib/google-auth';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wiped = searchParams.get('wiped') === '1';
  const [selfPanicAck, setSelfPanicAck] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('ssc_panic_self_ack') === '1') {
        sessionStorage.removeItem('ssc_panic_self_ack');
        setSelfPanicAck(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const { loginWithToken, unlockPrivateKey, refreshUser } = useAuth();
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetchGoogleConfig().then((c) => setGoogleEnabled(!!c.enabled));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', {
        email, password,
        totp_code: needs2FA ? totpCode : undefined,
        captcha_token: captchaToken,
      });
      await loginWithToken(data.token, data.user);
      try {
        await unlockPrivateKey(password);
      } catch {
        /* vault unlock is silent — Signal handles new messages */
      }
      toast.success(t('welcomeBack'));
      navigate('/chat');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.headers?.['x-requires-2fa'] === '1' || /2fa/i.test(detail || '')) {
        setNeeds2FA(true);
        toast.message(t('enter2fa'));
      } else if (!err?.response) {
        toast.error(`${t('cannotReachServer')} (${API})`);
      } else if (err?.response?.status === 410) {
        toast.error(detail || t('accountDeletedPanic'));
      } else if (
        err?.response?.status === 401
        && (
          err?.response?.headers?.['x-auth-provider'] === 'google'
          || /google sign-in/i.test(detail || '')
        )
      ) {
        toast.error(t('googleOnlyLoginHint'));
      } else {
        toast.error(detail || t('loginFailed'));
      }
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
          <div className="flex items-center justify-between mb-10">
            <Link to="/" className="flex items-center gap-2" data-testid="back-to-landing">
              <div className="w-8 h-8 rounded-md bg-[#00E5FF] flex items-center justify-center">
                <LockKey size={18} weight="bold" className="text-black" />
              </div>
              <span className="font-mono text-sm tracking-[0.25em]">SSC</span>
            </Link>
            <LanguagePicker className="w-36" />
          </div>

          <h1 className="font-mono text-3xl font-bold tracking-tighter">{t('loginTitle')}</h1>
          <p className="text-[#A1A1AA] text-sm mt-2">{t('loginSubtitle')}</p>
          {selfPanicAck && (
            <div className="mt-4 p-3 rounded-md border border-[#27272A] bg-[#121212] text-sm" data-testid="panic-self-ack">
              <p className="text-[#A1A1AA] text-xs">{t('panicSelfAck')}</p>
            </div>
          )}
          {wiped && (
            <div className="mt-4 p-3 rounded-md border border-[#FF3B30]/40 bg-[#FF3B30]/10 text-sm" data-testid="legacy-wiped-notice">
              <p className="text-[#FF3B30] font-medium">{t('wipedNoticeTitle')}</p>
              <p className="text-[#A1A1AA] mt-1 text-xs">
                {t('wipedNoticeBody')}{' '}
                <Link to="/register" className="text-[#00E5FF] underline">{t('registerAgain')}</Link>
              </p>
            </div>
          )}
          {isNativeApp() && (
            <p className="text-[10px] font-mono text-[#52525B] mt-2 break-all">Server: {API}</p>
          )}

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('emailOrUsername')}</label>
              <input
                data-testid="login-email-input"
                type="text" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 text-sm" placeholder={t('emailPlaceholder')}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{t('password')}</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2.5 text-sm pr-10" placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white p-1" data-testid="toggle-password-visibility">
                  {show ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {needs2FA && (
              <div className="fade-up">
                <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA] flex items-center gap-1">
                  <ShieldCheck size={10} className="text-[#34C759]" /> {t('totpCode')}
                </label>
                <input data-testid="login-totp-input" required value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full mt-1.5 px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em]" placeholder="000000" />
              </div>
            )}

            <Turnstile onToken={setCaptchaToken} />

            <button
              type="submit" disabled={busy} data-testid="login-submit-button"
              className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-50"
            >
              {busy ? t('authenticating').toUpperCase() : t('signIn').toUpperCase()}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#27272A]" />
            <span className="text-[10px] font-mono text-[#A1A1AA] tracking-[0.25em]">{t('or')}</span>
            <div className="flex-1 h-px bg-[#27272A]" />
          </div>

          <button
            onClick={loginGoogle}
            disabled={busy || !googleEnabled}
            data-testid="login-google-button"
            className="w-full py-2.5 border border-[#27272A] bg-[#121212] hover:bg-[#1A1A1A] rounded-md flex items-center justify-center gap-2 text-sm transition disabled:opacity-40"
          >
            <GoogleLogo size={18} weight="bold" /> {googleEnabled ? t('continueGoogle') : t('googleNotConfigured')}
          </button>

          <p className="mt-8 text-sm text-[#A1A1AA] text-center">
            {t('noAccount')}{' '}
            <Link to="/register" data-testid="goto-register" className="text-[#00E5FF] hover:underline">{t('createOne')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}