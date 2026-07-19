import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { lookupPathForQuery } from '../../lib/inviteLink';
import { conversationLabel } from './displayUtils';

function labelFromUser(user, fallbackId) {
  if (!user) return fallbackId ? String(fallbackId).slice(0, 10) : 'Chat';
  if (user.display_name) return user.display_name;
  if (user.username) return `@${user.username}`;
  return user.id ? String(user.id).slice(0, 10) : 'Chat';
}

/**
 * Resolve human titles for conversation list (client lookups only).
 * Returns map: conversationId -> { title, subtitleHint }
 */
export function useConversationDirectory(conversations) {
  const [peerLabels, setPeerLabels] = useState({});
  const [groupNames, setGroupNames] = useState({});

  const peerIds = useMemo(
    () =>
      [
        ...new Set(
          (conversations || [])
            .filter((c) => c?.type !== 'group' && c?.peer_id)
            .map((c) => c.peer_id)
        ),
      ].sort(),
    [conversations]
  );

  const groupIds = useMemo(
    () =>
      [
        ...new Set(
          (conversations || [])
            .filter((c) => c?.type === 'group' && c?.group_id)
            .map((c) => c.group_id)
        ),
      ].sort(),
    [conversations]
  );

  const peerKey = peerIds.join('|');
  const groupKey = groupIds.join('|');

  useEffect(() => {
    let cancelled = false;
    async function loadPeers() {
      const ids = peerKey ? peerKey.split('|') : [];
      if (!ids.length) return;
      const next = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            const data = await api.get(lookupPathForQuery(id));
            next[id] = labelFromUser(data.user, id);
          } catch {
            next[id] = String(id).slice(0, 10);
          }
        })
      );
      if (!cancelled) setPeerLabels((prev) => ({ ...prev, ...next }));
    }
    loadPeers();
    return () => {
      cancelled = true;
    };
  }, [peerKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadGroups() {
      if (!groupKey) return;
      try {
        const data = await api.get('/api/groups');
        if (cancelled) return;
        const next = {};
        for (const g of data.groups || []) {
          if (g?.id) next[g.id] = g.name || `Group ${String(g.id).slice(0, 6)}`;
        }
        setGroupNames(next);
      } catch {
        if (!cancelled) setGroupNames({});
      }
    }
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [groupKey]);

  const titleFor = useMemo(() => {
    return (c) => {
      if (!c) return 'Chat';
      if (c.type === 'group') {
        return groupNames[c.group_id] || conversationLabel(c);
      }
      return peerLabels[c.peer_id] || conversationLabel(c);
    };
  }, [peerLabels, groupNames]);

  return { titleFor, peerLabels, groupNames };
}
