import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthSplash from './AuthSplash';

/** Installed apps open here — never the marketing website. */
export default function InstalledAppEntry() {
  const { user, loading } = useAuth();

  if (loading) return <AuthSplash />;

  return <Navigate to={user ? '/chat' : '/login'} replace />;
}