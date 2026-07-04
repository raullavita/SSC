import { useCallback, useState } from 'react';
import { suggestReplies } from './smartReply';

export function useSmartReplies() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async ({ messages, peerName, userId }) => {
    const incoming = (messages || []).filter((m) => m.sender_id !== userId);
    if (!incoming.length) {
      setSuggestions([]);
      return [];
    }
    setLoading(true);
    try {
      const replies = await suggestReplies({
        lastMessages: messages.slice(-8),
        peerName: peerName || 'contact',
      });
      setSuggestions(replies);
      return replies;
    } catch {
      setSuggestions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, loading, refresh, clear };
}