import { useCallback } from 'react';
import { api } from '../lib/api';

export function useConversationPrivacy(onUpdated) {
  const patchPrivacy = useCallback(
    async (conversationId, patch) => {
      const data = await api.patch(`/api/conversations/${conversationId}/privacy`, patch);
      onUpdated?.(data.conversation);
      return data.conversation;
    },
    [onUpdated]
  );

  const setOverride = useCallback(
    (conversationId, key, value) => patchPrivacy(conversationId, { [key]: value }),
    [patchPrivacy]
  );

  const clearOverride = useCallback(
    (conversationId, key) => patchPrivacy(conversationId, { [key]: null }),
    [patchPrivacy]
  );

  return { patchPrivacy, setOverride, clearOverride };
}