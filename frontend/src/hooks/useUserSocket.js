import { useRef } from 'react';
import { useSyncSocket } from './useSyncSocket';

/** User topic subscription via unified sync socket (calls, signals). */
export function useUserSocket({ userId, wsToken, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useSyncSocket({
    userId: userId || null,
    wsToken,
    topics: userId ? [`user:${userId}`] : [],
    enabled: Boolean(userId),
    onEvent: (envelope) => onEventRef.current?.(envelope.raw),
  });
}