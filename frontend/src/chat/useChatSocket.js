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
    onEvent: (envelope) => {
      const payload = envelope.payload || envelope.raw?.payload;
      const envelopeTopic = envelope.topic || envelope.raw?.topic;
      if (topic && envelopeTopic && envelopeTopic !== topic) return;
      if (topic && payload?.conversation_id && envelopeTopic?.startsWith('conversation:')) {
        const expected = topic.replace(/^conversation:/, '');
        if (payload.conversation_id !== expected) return;
      }
      onEventRef.current?.(envelope.raw);
    },
  });

  return null;
}