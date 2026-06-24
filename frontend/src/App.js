import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { hideNativeSplash } from './lib/capacitor-init';
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
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  if (loading) return <div className="mobile-shell flex items-center justify-center bg-[#0A0A0A] text-[#A1A1AA] font-mono text-xs safe-top safe-bottom">{t('initializing')}</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.username || !user.public_key) return <Navigate to="/setup" replace />;
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
      <Route path="/login" element={<Login />} />
      <Route path="/auth/google" element={<GoogleAuthCallback />} />
      <Route path="/register" element={<Register />} />
      <Route path="/setup" element={<SetupUsername />} />
      <Route path="/chat" element={<Protected><ChatHome /></Protected>} />
      <Route path="/chat/:conversationId" element={<Protected><ChatHome /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
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
      </BrowserRouter>
    </div>
  );
}
