import { useRef } from 'react';
import { useSyncSocket } from '../hooks/useSyncSocket';

/** Cross-conversation sync via unified socket. */
export function useUserConversationSync({ userId, wsToken, enabled, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useSyncSocket({
    userId: enabled && userId ? userId : null,
    wsToken,
    topics: enabled && userId ? [`user:${userId}`] : [],
    enabled: Boolean(enabled && userId),
    onEvent: (envelope) => onEventRef.current?.(envelope.payload),
  });
}