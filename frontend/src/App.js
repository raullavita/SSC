import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ChatHome from './pages/ChatHome';
import Landing from './pages/Landing';
import Login from './pages/Login';

export default function App() {
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