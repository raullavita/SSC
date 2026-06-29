import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EnvelopeSimple, CheckCircle, XCircle } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import LanguagePicker from '../components/LanguagePicker';

export default function VerifyEmail() {
  const { t } = useLocale();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('pending');
  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!token) {
      setStatus('missing');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post('/auth/verify-email', { token });
        if (!cancelled) setStatus('ok');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          toast.error(err?.response?.data?.detail || t('emailVerifyFailed'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, t]);

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] items-center justify-center p-6">
      <div className="w-full max-w-sm text-center fade-up">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="font-mono text-sm tracking-[0.25em]">SSC</Link>
          <LanguagePicker className="w-36" />
        </div>
        {status === 'pending' && (
          <>
            <EnvelopeSimple size={40} className="mx-auto text-[#00E5FF]" />
            <h1 className="font-mono text-2xl font-bold mt-4">{t('emailVerifyTitle')}</h1>
            <p className="text-[#A1A1AA] text-sm mt-2">{t('emailVerifyPending')}</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <CheckCircle size={40} className="mx-auto text-[#34C759]" weight="fill" />
            <h1 className="font-mono text-2xl font-bold mt-4">{t('emailVerifySuccessTitle')}</h1>
            <p className="text-[#A1A1AA] text-sm mt-2">{t('emailVerifySuccessBody')}</p>
            <Link to="/login" data-testid="verify-email-goto-login" className="inline-block mt-6 text-[#00E5FF] hover:underline">
              {t('signIn')}
            </Link>
          </>
        )}
        {(status === 'error' || status === 'missing') && (
          <>
            <XCircle size={40} className="mx-auto text-[#FF3B30]" weight="fill" />
            <h1 className="font-mono text-2xl font-bold mt-4">{t('emailVerifyFailedTitle')}</h1>
            <p className="text-[#A1A1AA] text-sm mt-2">{t('emailVerifyFailedBody')}</p>
            <Link to="/login" className="inline-block mt-6 text-[#00E5FF] hover:underline">{t('signIn')}</Link>
          </>
        )}
      </div>
    </div>
  );
}