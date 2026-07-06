import { useEffect, useRef } from 'react';
import { wsAuthPayload, wsUrl } from '../lib/api';
import { buildSubscribePayload } from '../lib/wsSubscribe';

/** Subscribe to user:{userId} for incoming calls and signals. */
export function useUserSocket({ userId, wsToken, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!userId) return undefined;

    const ws = new WebSocket(wsUrl());
    ws.onopen = async () => {
      const auth = wsAuthPayload(wsToken);
      if (auth) ws.send(auth);
      const topic = `user:${userId}`;
      ws.send(await buildSubscribePayload(topic));
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