import { useCallback, useEffect, useState } from 'react';
import { fetchPresence, formatPresenceBucket } from '../lib/presence';

export function usePresenceMap(peerIds = [], { scopedPeerId, scopedConversationId } = {}) {
  const [map, setMap] = useState({});

  const refresh = useCallback(async () => {
    const unique = [...new Set(peerIds.filter(Boolean))];
    if (!unique.length) return;
    const entries = [];
    const batchSize = 3;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const batchEntries = await Promise.all(
        batch.map(async (id) => {
          try {
            const data = await fetchPresence(id, {
              conversationId: id === scopedPeerId ? scopedConversationId : undefined,
            });
            return [id, formatPresenceBucket(data.bucket)];
          } catch {
            return [id, ''];
          }
        })
      );
      entries.push(...batchEntries);
    }
    setMap(Object.fromEntries(entries));
  }, [peerIds, scopedPeerId, scopedConversationId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return map;
}