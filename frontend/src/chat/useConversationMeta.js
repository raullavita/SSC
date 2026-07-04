import { useCallback } from 'react';
import { api } from '../lib/api';

export function useConversationMeta(onUpdated) {
  const patchMeta = useCallback(
    async (conversationId, patch) => {
      const data = await api.patch(`/api/conversations/${conversationId}/meta`, patch);
      onUpdated?.(data.conversation);
      return data.conversation;
    },
    [onUpdated]
  );

  const togglePin = useCallback(
    (conversationId, pinned) => patchMeta(conversationId, { pinned }),
    [patchMeta]
  );

  const toggleMute = useCallback(
    (conversationId, muted) => patchMeta(conversationId, { muted }),
    [patchMeta]
  );

  return { patchMeta, togglePin, toggleMute };
}