import { useEffect, useRef } from 'react';
import { wsAuthPayload, wsUrl } from '../lib/api';
import { buildSubscribePayload } from '../lib/wsSubscribe';

/**
 * Subscribe to user:* WS topic for cross-conversation sync (unread bumps).
 */
export function useUserConversationSync({ userId, wsToken, enabled, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    const ws = new WebSocket(wsUrl());
    const topic = `user:${userId}`;

    ws.onopen = async () => {
      const auth = wsAuthPayload(wsToken);
      if (auth) ws.send(auth);
      ws.send(await buildSubscribePayload(topic));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEventRef.current?.(data?.payload || data);
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
    };
  }, [enabled, userId, wsToken]);
}