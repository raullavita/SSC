import { Navigate, Routes, Route } from 'react-router-dom';
import CryptoRuntimeGate from './components/CryptoRuntimeGate';
import InstalledClientGate from './components/InstalledClientGate';
import InstalledAppEntry from './components/InstalledAppEntry';
import { AuthProvider } from './context/AuthContext';
import { isInstalledApp, isMarketingWebOnly } from './lib/appMode';
import ChatHome from './pages/ChatHome';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AddContact from './pages/AddContact';
import AddContactLanding from './pages/AddContactLanding';
import RecoveryLogin from './pages/RecoveryLogin';
import DeviceLink from './pages/DeviceLink';
import Settings from './pages/Settings';
import SetupUsername from './pages/SetupUsername';

const LANDING_ONLY = isMarketingWebOnly();

function AppRoot() {
  if (isInstalledApp()) return <InstalledAppEntry />;
  return <Landing />;
}

function AppFallback() {
  if (isInstalledApp()) return <Navigate to="/login" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  if (LANDING_ONLY) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/add/:username" element={<AddContactLanding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <AuthProvider>
      <CryptoRuntimeGate>
      <InstalledClientGate>
        <Routes>
          <Route path="/" element={<AppRoot />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recovery" element={<RecoveryLogin />} />
          <Route path="/auth/google" element={<GoogleAuthCallback />} />
          <Route path="/setup-username" element={<SetupUsername />} />
          <Route path="/chat" element={<ChatHome />} />
          <Route path="/add/:username" element={<AddContact />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/link-device" element={<DeviceLink />} />
          <Route path="*" element={<AppFallback />} />
        </Routes>
      </InstalledClientGate>
      </CryptoRuntimeGate>
    </AuthProvider>
  );
}