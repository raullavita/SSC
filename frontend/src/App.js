import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ChatHome from './pages/ChatHome';
import Landing from './pages/Landing';
import Login from './pages/Login';

const LANDING_ONLY = process.env.REACT_APP_SSC_LANDING_ONLY === 'true';

export default function App() {
  if (LANDING_ONLY) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ChatHome />} />
      </Routes>
    </AuthProvider>
  );
}