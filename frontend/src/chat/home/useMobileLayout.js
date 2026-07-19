import { useEffect, useState } from 'react';
import { isAndroidShell } from '../../lib/appMode';

const MQ = '(max-width: 768px)';

/**
 * True on Android WebView shell or narrow viewports (phone / small tablet).
 * Used for list ↔ full-screen thread navigation.
 */
export function useMobileLayout() {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (isAndroidShell()) return true;
    return window.matchMedia(MQ).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isAndroidShell()) {
      setNarrow(true);
      return undefined;
    }
    const media = window.matchMedia(MQ);
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return narrow || isAndroidShell();
}
