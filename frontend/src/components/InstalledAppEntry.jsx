import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../lib/onboarding';
import AuthSplash from './AuthSplash';

/** Installed apps open here — never the marketing website. */
export default function InstalledAppEntry() {
  const { user, loading } = useAuth();

  if (loading) return <AuthSplash />;

  return <Navigate to={user ? postAuthPath(user) : '/login'} replace />;
}