import { useCallback, useEffect, useState } from 'react';
import { fetchPresence, formatPresenceBucket } from '../lib/presence';

export function usePresenceMap(peerIds = []) {
  const [map, setMap] = useState({});

  const refresh = useCallback(async () => {
    const unique = [...new Set(peerIds.filter(Boolean))];
    if (!unique.length) return;
    const entries = await Promise.all(
      unique.map(async (id) => {
        try {
          const data = await fetchPresence(id);
          return [id, formatPresenceBucket(data.bucket)];
        } catch {
          return [id, ''];
        }
      })
    );
    setMap(Object.fromEntries(entries));
  }, [peerIds]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return map;
}