import { useEffect, useRef } from 'react';
import { wsUrl } from '../lib/api';

/** Subscribe to user:{userId} for incoming calls and signals. */
export function useUserSocket({ userId, wsToken, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!userId || !wsToken) return undefined;

    const ws = new WebSocket(wsUrl(wsToken));
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', topic: `user:${userId}` }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEventRef.current?.(data);
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, [userId, wsToken]);
}