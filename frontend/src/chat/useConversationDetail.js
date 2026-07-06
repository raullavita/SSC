import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/** Fetch a single conversation by id (GET /api/conversations/:id). */
export function useConversationDetail(conversationId) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/conversations/${conversationId}`);
      setConversation(data.conversation ?? data);
      return data.conversation ?? data;
    } catch (err) {
      setError(err);
      setConversation(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return { conversation, loading, error, refresh };
}