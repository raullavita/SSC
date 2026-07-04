/**
 * Group call hook — mesh (≤8) or SFU (>8) — Engine 9 scaffold.
 */

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { createSfuRoom, fetchSfuConfig } from './sfuClient';

const MESH_MAX = 8;

export function useGroupCall({ conversationId, participantCount }) {
  const [call, setCall] = useState(null);
  const [mode, setMode] = useState(null);
  const [sfuRoom, setSfuRoom] = useState(null);
  const [error, setError] = useState(null);

  const startGroupCall = useCallback(
    async (video = false) => {
      if (!conversationId) return null;
      setError(null);
      try {
        const useSfu = participantCount > MESH_MAX;
        if (useSfu) {
          const cfg = await fetchSfuConfig();
          if (!cfg.enabled) {
            throw new Error('SFU not enabled on server');
          }
          const room = await createSfuRoom(conversationId, participantCount);
          setSfuRoom(room);
          setMode('sfu');
          return room;
        }

        const data = await api.post('/api/calls', {
          conversation_id: conversationId,
          group_call: true,
          video,
        });
        setCall(data.call);
        setMode(data.mode || 'mesh');
        return data;
      } catch (e) {
        setError(e.message || 'Failed to start group call');
        return null;
      }
    },
    [conversationId, participantCount]
  );

  return { call, mode, sfuRoom, startGroupCall, error };
}