import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { completeGoogleAuth } from '../lib/google-auth';
import { api } from '../lib/api';
import { isNativeApp } from '../lib/platform';
import { persistSessionToken } from '../lib/sessionStore';

/** Handles OAuth redirect: /auth/google?needs_setup=0|1 (web cookie) or ?token=… (native). */
export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const token = params.get('token');
    const needsSetup = params.get('needs_setup') === '1';

    (async () => {
      try {
        if (isNativeApp()) {
          if (!token) {
            toast.error('Google sign-in failed — no token');
            navigate('/login');
            return;
          }
          persistSessionToken(token);
          const { data: user } = await api.get('/auth/me');
          await completeGoogleAuth(
            { token, user, needs_username: needsSetup },
            { loginWithToken, navigate },
          );
        } else {
          const { data: user } = await api.get('/auth/me');
          await completeGoogleAuth(
            { token: null, user, needs_username: needsSetup },
            { loginWithToken, navigate },
          );
        }
        toast.success('Signed in with Google');
      } catch {
        toast.error('Google sign-in failed');
        navigate('/login');
      }
    })();
  }, [loginWithToken, navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-[#A1A1AA] font-mono text-xs tracking-[0.25em]">
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] pulse-glow" />
        COMPLETING GOOGLE SIGN-IN…
      </div>
    </div>
  );
}