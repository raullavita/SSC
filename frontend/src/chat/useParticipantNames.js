import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { lookupPathForQuery } from '../lib/inviteLink';

function labelFromUser(user) {
  if (!user) return '';
  return user.display_name || (user.username ? `@${user.username}` : '') || user.id?.slice(0, 10) || '';
}

/**
 * Resolve display labels for group members and 1:1 peers (cached per session).
 */
export function useParticipantNames({ groupId, peerId, isGroup, enabled }) {
  const [namesById, setNamesById] = useState({});

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    async function load() {
      try {
        if (isGroup && groupId) {
          const data = await api.get(`/api/groups/${groupId}/members`);
          if (cancelled) return;
          const next = {};
          for (const member of data.members || []) {
            if (member?.id) next[member.id] = labelFromUser(member);
          }
          setNamesById(next);
          return;
        }

        if (peerId) {
          const data = await api.get(lookupPathForQuery(peerId));
          if (cancelled) return;
          const user = data.user;
          if (user?.id) {
            setNamesById({ [user.id]: labelFromUser(user) });
          }
        }
      } catch {
        if (!cancelled) setNamesById({});
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, peerId, isGroup, enabled]);

  const nameForId = useCallback(
    (userId, currentUserId) => {
      if (!userId) return 'Someone';
      if (userId === currentUserId) return 'You';
      return namesById[userId] || userId.slice(0, 10);
    },
    [namesById]
  );

  return { namesById, nameForId };
}