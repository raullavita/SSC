import { useRef } from 'react';
import { useSyncSocket } from '../hooks/useSyncSocket';

/** Conversation topic subscription via unified sync socket. */
export function useChatSocket({ enabled, topic, onEvent, wsToken, userId }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useSyncSocket({
    userId: enabled && userId ? userId : null,
    wsToken,
    topics: enabled && topic ? [topic] : [],
    enabled: Boolean(enabled && topic && userId),
    onEvent: (envelope) => onEventRef.current?.(envelope.raw),
  });

  return null;
}