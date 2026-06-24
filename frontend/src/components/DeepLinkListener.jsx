import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeDeepLink } from '../lib/deepLink';

/** Routes Capacitor/desktop deep links through React Router (no full page reload). */
export default function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeDeepLink((event) => {
      const { path, search, hash } = event.detail || {};
      if (!path) return;
      navigate(`${path}${search || ''}${hash || ''}`, { replace: true });
    });
  }, [navigate]);

  return null;
}