import { useEffect, useRef } from 'react';
import { wsAuthPayload, wsUrl } from '../lib/api';

export function useChatSocket({ enabled, topic, onEvent, wsToken }) {
  const socketRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !topic) return undefined;

    const ws = new WebSocket(wsUrl());
    socketRef.current = ws;

    ws.onopen = () => {
      const auth = wsAuthPayload(wsToken);
      if (auth) ws.send(auth);
      ws.send(JSON.stringify({ type: 'subscribe', topic }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEventRef.current?.(data);
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [enabled, topic, wsToken]);

  return socketRef;
}