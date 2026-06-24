import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Register from './pages/Register';
import SetupUsername from './pages/SetupUsername';
import AuthCallback from './pages/AuthCallback';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import ChatHome from './pages/ChatHome';
import Landing from './pages/Landing';
import InstalledClientGate from './components/InstalledClientGate';
import { hideNativeSplash } from './lib/capacitor-init';
import { isInstalledClient, prefersHashRouter } from './lib/platform';
import { bootstrapSignalIdentity, userHasUnifiedIdentity } from './lib/signalIdentityBootstrap';
import './App.css';

/** Dismiss native splash after auth bootstrap + first paint. */
function NativeBootGate({ children }) {
  const { loading } = useAuth();
  useEffect(() => {
    if (loading) return undefined;
    const id = requestAnimationFrame(() => {
      hideNativeSplash();
    });
    return () => cancelAnimationFrame(id);
  }, [loading]);
  return children;
}

function Protected({ children }) {
  const { user, loading, refreshUser } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const [identityBoot, setIdentityBoot] = React.useState(isInstalledClient() ? 'pending' : 'done');

  React.useEffect(() => {
    if (!user || !isInstalledClient() || identityBoot !== 'pending') return;
    let cancelled = false;
    bootstrapSignalIdentity(refreshUser).then((res) => {
      if (cancelled) return;
      setIdentityBoot(res.ok ? 'done' : 'failed');
    });
    return () => { cancelled = true; };
  }, [user, refreshUser, identityBoot]);

  if (loading || identityBoot === 'pending') {
    return <div className="mobile-shell flex items-center justify-center bg-[#0A0A0A] text-[#A1A1AA] font-mono text-xs safe-top safe-bottom">{t('initializing')}</div>;
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.username || !user.public_key) return <Navigate to="/setup" replace />;
  if (isInstalledClient() && !userHasUnifiedIdentity(user)) {
    return (
      <div className="mobile-shell flex items-center justify-center bg-[#0A0A0A] text-[#A1A1AA] font-mono text-xs p-6 text-center safe-top safe-bottom">
        {t('signalIdentityRequired')}
      </div>
    );
  }
  return children;
}

function AppRouter() {
  const location = useLocation();
  // OAuth callback handling (Google currently disabled; keep for future standard OAuth)
  if (location.hash?.includes('session_id=') || location.search?.includes('code=')) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<InstalledClientGate><Login /></InstalledClientGate>} />
      <Route path="/auth/google" element={<InstalledClientGate><GoogleAuthCallback /></InstalledClientGate>} />
      <Route path="/register" element={<InstalledClientGate><Register /></InstalledClientGate>} />
      <Route path="/setup" element={<InstalledClientGate><SetupUsername /></InstalledClientGate>} />
      <Route path="/chat" element={<InstalledClientGate><Protected><ChatHome /></Protected></InstalledClientGate>} />
      <Route path="/chat/:conversationId" element={<InstalledClientGate><Protected><ChatHome /></Protected></InstalledClientGate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const Router = prefersHashRouter() ? HashRouter : BrowserRouter;
  return (
    <div className="App grain">
      <Router>
        <AuthProvider>
          <LocaleProvider>
            <NativeBootGate>
              <AppRouter />
            </NativeBootGate>
          </LocaleProvider>
          <Toaster
            theme="dark"
            position="top-center"
            offset={16}
            style={{ zIndex: 99999 }}
            toastOptions={{ style: { background: '#1A1A1A', border: '1px solid #27272A', color: '#F0F0F0', zIndex: 99999 } }}
          />
        </AuthProvider>
      </Router>
    </div>
  );
}
