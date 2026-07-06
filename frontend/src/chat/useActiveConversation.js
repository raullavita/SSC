import { useCallback, useEffect, useMemo } from 'react';
import { mergeConversationMeta } from '../lib/conversationMeta';
import { useConversationDetail } from './useConversationDetail';

/**
 * Merge list row + GET /api/conversations/:id detail for the active thread.
 */
export function useActiveConversation(conversations, activeId, onListUpdated) {
  const activeFromList = useMemo(
    () => conversations.find((entry) => entry.id === activeId) || null,
    [conversations, activeId]
  );

  const { conversation: detail, refresh, loading, error } = useConversationDetail(activeId);

  useEffect(() => {
    if (detail) onListUpdated?.(detail);
  }, [detail, onListUpdated]);

  const active = useMemo(
    () => mergeConversationMeta(activeFromList, detail),
    [activeFromList, detail]
  );

  const applyListPatch = useCallback(
    (patch) => {
      if (patch) onListUpdated?.(patch);
    },
    [onListUpdated]
  );

  return {
    active,
    refresh,
    loading,
    error,
    applyListPatch,
  };
}