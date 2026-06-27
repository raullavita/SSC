import React, { useEffect, useRef } from 'react';
import { isInstalledClient } from '../lib/platform';

/**
 * Cloudflare Turnstile widget. Reads sitekey from REACT_APP_TURNSTILE_SITEKEY.
 * Calls onToken(token) when verified.
 */
export default function Turnstile({ onToken }) {
  const ref = useRef(null);
  const widgetIdRef = useRef(null);
  const sitekey = process.env.REACT_APP_TURNSTILE_SITEKEY;

  useEffect(() => {
    if (!sitekey) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !ref.current) return;
      try {
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey,
          theme: 'dark',
          callback: (token) => onToken && onToken(token),
          'error-callback': () => onToken && onToken(null),
          'expired-callback': () => onToken && onToken(null),
        });
      } catch (e) {
        // already rendered
      }
    };
    if (window.turnstile) {
      render();
    } else {
      const t = setInterval(() => {
        if (window.turnstile) { clearInterval(t); render(); }
      }, 200);
      return () => clearInterval(t);
    }
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitekey]);

  if (!sitekey || isInstalledClient()) return null;
  return <div ref={ref} data-testid="turnstile-widget" className="mt-2" />;
}
