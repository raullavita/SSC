import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/index.css';
import App from '@/App';
import { initCapacitor } from '@/lib/capacitor-init';
import { isBrowserDevAllowed, supportsWebPush } from '@/lib/platform';

initCapacitor();

// Web push only for founder browser-dev mode — not a public product surface
if (isBrowserDevAllowed() && supportsWebPush()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  navigator.serviceWorker.addEventListener?.('message', (event) => {
    if (event.data?.type === 'navigate' && event.data.target) {
      window.location.assign(event.data.target);
    }
    if (event.data?.type === 'call_notification') {
      sessionStorage.setItem('ssc_pending_call', JSON.stringify(event.data));
      const target = event.data.data?.conversation_id ? `/chat/${event.data.data.conversation_id}` : '/chat';
      if (window.location.pathname.startsWith('/chat')) {
        window.dispatchEvent(new CustomEvent('ssc-call-notification', { detail: event.data }));
      } else {
        window.location.assign(target);
      }
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);