import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

function TurnstileWidget({ siteKey, onToken }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    function renderWidget() {
      if (!window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken?.(token),
        'expired-callback': () => onToken?.(''),
        'error-callback': () => onToken?.(''),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector('script[data-ssc-turnstile]');
      if (existing) {
        existing.addEventListener('load', renderWidget);
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.sscTurnstile = '1';
        script.onload = renderWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current != null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current != null && window.turnstile?.reset) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  if (!siteKey) return null;
  return <div ref={containerRef} aria-label="Security check" />;
}

export default forwardRef(TurnstileWidget);